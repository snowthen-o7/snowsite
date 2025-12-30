/**
 * Memory-efficient diff calculator using hash-based comparison.
 * 
 * TypeScript port of data_diff_checker's EfficientDiffer.
 * 
 * This module provides efficient CSV comparison that:
 * - Uses hashes for fast row comparison (stores hashes, not full rows)
 * - Performs two-pass algorithm: quick hash comparison, then detailed diff
 * - Separates "meaningful" changes from inventory/availability changes
 * - Tracks line numbers for debugging
 * - Supports composite primary keys
 */

import type { ParsedCSV } from '../types/csv';
import {
  EXCLUDED_COLUMN_PATTERNS,
  DEFAULT_MAX_EXAMPLES,
  COMMON_PRIMARY_KEY_NAMES,
  PRIMARY_KEY_UNIQUENESS_THRESHOLD,
  isExcludedColumn as isExcludedColumnFromConfig,
} from './config';

// Re-export for convenience
export const DEFAULT_EXCLUDED_PATTERNS = EXCLUDED_COLUMN_PATTERNS;

// ----- Types -----

export interface DiffOptions {
  /** Column(s) that uniquely identify rows. Can be single string or array for composite keys */
  primaryKeys: string[];
  /** Maximum example IDs to collect for each change type */
  maxExamples?: number;
  /** Column name patterns to exclude from "meaningful" changes */
  excludedPatterns?: string[];
  /** Case sensitive comparison */
  caseSensitive?: boolean;
  /** Trim whitespace before comparison */
  trimWhitespace?: boolean;
}

export interface DiffResult {
  /** Rows present in dev but not in prod */
  rows_added: number;
  /** Rows present in prod but not in dev */
  rows_removed: number;
  /** Rows with meaningful changes (excludes inventory/availability) */
  rows_updated: number;
  /** Rows where only excluded columns changed */
  rows_updated_excluded_only: number;
  /** Per-column change counts (only meaningful columns) */
  detailed_key_update_counts: Record<string, number>;
  /** Sample changed rows with line numbers and actual changes */
  example_ids: Record<string, {
    prod_line_num: number;
    dev_line_num: number;
    changes: Array<{ column: string; oldValue: string; newValue: string }>;
  }>;
  /** Sample added rows with line numbers and preview data */
  example_ids_added: Record<string, {
    dev_line_num: number;
    preview: Array<{ column: string; value: string }>;
  }>;
  /** Sample removed rows with line numbers and preview data */
  example_ids_removed: Record<string, {
    prod_line_num: number;
    preview: Array<{ column: string; value: string }>;
  }>;
  /** Columns present in both files */
  common_keys: string[];
  /** Columns only in production file */
  prod_only_keys: string[];
  /** Columns only in development file */
  dev_only_keys: string[];
  /** Total rows in production file */
  prod_row_count: number;
  /** Total rows in development file */
  dev_row_count: number;
}

interface RowIndex {
  lineNum: number;
  fullHash: string;
  compHash: string;
  displayKey: string;
}

// ----- Utility Functions -----

/**
 * Simple string hash function (faster than crypto for browser use)
 * Uses djb2 algorithm - good distribution, fast computation
 */
function hashString(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  // Convert to hex string
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Check if a column should be excluded from meaningful change detection.
 * Uses the shared config function.
 */
function isExcludedColumn(columnName: string, patterns: string[]): boolean {
  return isExcludedColumnFromConfig(columnName, patterns);
}

/**
 * Create a composite key from primary key values.
 */
function makeCompositeKey(row: Record<string, string>, primaryKeys: string[]): string {
  return primaryKeys.map(k => row[k] ?? '').join('||');
}

/**
 * Get a display-friendly primary key (single value or composite).
 */
function getDisplayKey(row: Record<string, string>, primaryKeys: string[]): string {
  if (primaryKeys.length === 1) {
    const value = row[primaryKeys[0]];
    return value === undefined || value === null ? '<missing>' : String(value);
  }
  
  return primaryKeys
    .map(k => {
      const value = row[k];
      return value === undefined || value === null ? '<missing>' : String(value);
    })
    .join('_');
}

/**
 * Create a hash of row values for the given keys.
 */
function hashRow(
  row: Record<string, string>,
  keys: string[],
  caseSensitive: boolean,
  trimWhitespace: boolean
): string {
  // Sort keys for consistent hashing
  const sortedKeys = [...keys].sort();
  const values = sortedKeys.map(k => {
    let val = row[k] ?? '';
    if (trimWhitespace) val = val.trim();
    if (!caseSensitive) val = val.toLowerCase();
    return val;
  }).join('|');
  
  return hashString(values);
}

/**
 * Normalize a value for comparison.
 */
function normalizeValue(
  value: string,
  caseSensitive: boolean,
  trimWhitespace: boolean
): string {
  let normalized = value ?? '';
  if (trimWhitespace) normalized = normalized.trim();
  if (!caseSensitive) normalized = normalized.toLowerCase();
  return normalized;
}

// ----- Main Differ Class -----

export class EfficientDiffer {
  private primaryKeys: string[];
  private maxExamples: number;
  private excludedPatterns: string[];
  private caseSensitive: boolean;
  private trimWhitespace: boolean;

  constructor(options: DiffOptions) {
    this.primaryKeys = options.primaryKeys;
    this.maxExamples = options.maxExamples ?? DEFAULT_MAX_EXAMPLES;
    this.excludedPatterns = options.excludedPatterns ?? EXCLUDED_COLUMN_PATTERNS;
    this.caseSensitive = options.caseSensitive ?? true;
    this.trimWhitespace = options.trimWhitespace ?? true;
  }

  /**
   * Compute differences between two CSV files.
   * 
   * Uses a three-phase algorithm:
   * 1. Build prod index with hashes
   * 2. Build dev index, detect added rows, find changed rows via hash comparison
   * 3. Second pass on changed rows to collect detailed changes
   */
  computeDiff(prodCsv: ParsedCSV, devCsv: ParsedCSV): DiffResult {
    const prodHeaders = new Set(prodCsv.headers);
    const devHeaders = new Set(devCsv.headers);

    // Validate primary keys exist
    const missingProd = this.primaryKeys.filter(k => !prodHeaders.has(k));
    if (missingProd.length > 0) {
      throw new Error(
        `Primary keys [${missingProd.join(', ')}] not found in production file. ` +
        `Available columns: ${[...prodHeaders].sort().join(', ')}`
      );
    }

    const missingDev = this.primaryKeys.filter(k => !devHeaders.has(k));
    if (missingDev.length > 0) {
      throw new Error(
        `Primary keys [${missingDev.join(', ')}] not found in development file. ` +
        `Available columns: ${[...devHeaders].sort().join(', ')}`
      );
    }

    // Compute column sets
    const commonKeys = [...prodHeaders].filter(h => devHeaders.has(h));
    const prodOnlyKeys = [...prodHeaders].filter(h => !devHeaders.has(h));
    const devOnlyKeys = [...devHeaders].filter(h => !prodHeaders.has(h));

    // Identify excluded columns
    const excludedColumns = new Set(
      commonKeys.filter(k => isExcludedColumn(k, this.excludedPatterns))
    );
    const comparisonKeys = commonKeys.filter(k => !excludedColumns.has(k));

    // Process differences
    const diffStats = this.processDifferences(
      prodCsv,
      devCsv,
      commonKeys,
      comparisonKeys
    );

    return {
      ...diffStats,
      common_keys: commonKeys.sort(),
      prod_only_keys: prodOnlyKeys.sort(),
      dev_only_keys: devOnlyKeys.sort(),
      prod_row_count: prodCsv.rowCount,
      dev_row_count: devCsv.rowCount,
    };
  }

  /**
   * Process differences between two files using hash-based comparison.
   */
  private processDifferences(
    prodCsv: ParsedCSV,
    devCsv: ParsedCSV,
    commonKeys: string[],
    comparisonKeys: string[]
  ): Omit<DiffResult, 'common_keys' | 'prod_only_keys' | 'dev_only_keys' | 'prod_row_count' | 'dev_row_count'> {
    
    // Phase 1: Build production index
    // Format: compositeKey -> { lineNum, fullHash, compHash, displayKey }
    const prodIndex = new Map<string, RowIndex>();

    for (let i = 0; i < prodCsv.rows.length; i++) {
      const row = prodCsv.rows[i];
      const lineNum = i + 1; // 1-indexed line numbers
      const compositeKey = makeCompositeKey(row, this.primaryKeys);
      const fullHash = hashRow(row, commonKeys, this.caseSensitive, this.trimWhitespace);
      const compHash = comparisonKeys.length > 0
        ? hashRow(row, comparisonKeys, this.caseSensitive, this.trimWhitespace)
        : fullHash;
      const displayKey = getDisplayKey(row, this.primaryKeys);

      // Last occurrence wins for duplicates (matches Python behavior)
      prodIndex.set(compositeKey, { lineNum, fullHash, compHash, displayKey });
    }

    // Phase 2: Build dev index and detect changes
    const devIndex = new Map<string, { lineNum: number; fullHash: string; compHash: string }>();
    
    // Counters
    let rowsAdded = 0;
    let rowsChangedMeaningful = 0;
    let rowsChangedExcludedOnly = 0;

    // Collections
    const detailedChanges: Record<string, number> = {};
    const exampleIds: Record<string, {
      prod_line_num: number;
      dev_line_num: number;
      changes: Array<{ column: string; oldValue: string; newValue: string }>;
    }> = {};
    const exampleIdsAdded: Record<string, {
      dev_line_num: number;
      preview: Array<{ column: string; value: string }>;
    }> = {};
    const exampleIdsRemoved: Record<string, {
      prod_line_num: number;
      preview: Array<{ column: string; value: string }>;
    }> = {};

    // Track keys for change categorization
    const allChangedKeys = new Set<string>();
    const meaningfulChangeKeys = new Set<string>();
    const excludedOnlyKeys = new Set<string>();
    const addedKeys = new Set<string>();

    let addedExamplesCollected = 0;

    // Build dev index
    for (let i = 0; i < devCsv.rows.length; i++) {
      const row = devCsv.rows[i];
      const lineNum = i + 1;
      const compositeKey = makeCompositeKey(row, this.primaryKeys);
      const fullHash = hashRow(row, commonKeys, this.caseSensitive, this.trimWhitespace);
      const compHash = comparisonKeys.length > 0
        ? hashRow(row, comparisonKeys, this.caseSensitive, this.trimWhitespace)
        : fullHash;

      // Last occurrence wins
      devIndex.set(compositeKey, { lineNum, fullHash, compHash });

      // Track added rows (keys not in prod)
      if (!prodIndex.has(compositeKey)) {
        if (!addedKeys.has(compositeKey)) {
          rowsAdded++;
          addedKeys.add(compositeKey);

          // Collect example for added row
          if (addedExamplesCollected < this.maxExamples) {
            const displayKey = getDisplayKey(row, this.primaryKeys);
            // Get preview of first few non-primary-key columns with values
            const preview: Array<{ column: string; value: string }> = [];
            for (const col of devCsv.headers) {
              if (this.primaryKeys.includes(col)) continue;
              const value = row[col] ?? '';
              if (value && preview.length < 4) {
                preview.push({ column: col, value });
              }
            }
            exampleIdsAdded[displayKey] = { dev_line_num: lineNum, preview };
            addedExamplesCollected++;
          }
        }
      }
    }

    // Compare hashes to identify changes
    for (const [compositeKey, devEntry] of devIndex) {
      const prodEntry = prodIndex.get(compositeKey);
      if (prodEntry) {
        if (devEntry.fullHash !== prodEntry.fullHash) {
          allChangedKeys.add(compositeKey);
          
          // Categorize: meaningful vs excluded-only
          if (devEntry.compHash !== prodEntry.compHash) {
            rowsChangedMeaningful++;
            meaningfulChangeKeys.add(compositeKey);
          } else {
            rowsChangedExcludedOnly++;
            excludedOnlyKeys.add(compositeKey);
          }
        }
      }
    }

    // Count removed rows and collect examples
    let removedExamplesCollected = 0;
    let rowsRemoved = 0;

    for (const [compositeKey, prodEntry] of prodIndex) {
      if (!devIndex.has(compositeKey)) {
        rowsRemoved++;
        if (removedExamplesCollected < this.maxExamples) {
          // Look up the actual row to get preview data
          const row = prodCsv.rows[prodEntry.lineNum - 1]; // lineNum is 1-indexed
          const preview: Array<{ column: string; value: string }> = [];
          if (row) {
            for (const col of prodCsv.headers) {
              if (this.primaryKeys.includes(col)) continue;
              const value = row[col] ?? '';
              if (value && preview.length < 4) {
                preview.push({ column: col, value });
              }
            }
          }
          exampleIdsRemoved[prodEntry.displayKey] = {
            prod_line_num: prodEntry.lineNum,
            preview,
          };
          removedExamplesCollected++;
        }
      }
    }

    // Phase 3: Get detailed changes for changed rows
    if (allChangedKeys.size > 0) {
      // Build lookup of needed prod rows
      const neededProdRows = new Map<string, Record<string, string>>();
      
      for (let i = 0; i < prodCsv.rows.length; i++) {
        const row = prodCsv.rows[i];
        const compositeKey = makeCompositeKey(row, this.primaryKeys);
        if (allChangedKeys.has(compositeKey)) {
          // Extract only common keys, last occurrence wins
          const filtered: Record<string, string> = {};
          for (const k of commonKeys) {
            filtered[k] = row[k] ?? '';
          }
          neededProdRows.set(compositeKey, filtered);
        }
      }

      // Build lookup of needed dev rows with line numbers
      const neededDevRows = new Map<string, { lineNum: number; row: Record<string, string> }>();
      
      for (let i = 0; i < devCsv.rows.length; i++) {
        const row = devCsv.rows[i];
        const lineNum = i + 1;
        const compositeKey = makeCompositeKey(row, this.primaryKeys);
        if (allChangedKeys.has(compositeKey)) {
          const filtered: Record<string, string> = {};
          for (const k of commonKeys) {
            filtered[k] = row[k] ?? '';
          }
          neededDevRows.set(compositeKey, { lineNum, row: filtered });
        }
      }

      // Compare each changed row
      let examplesCollected = 0;

      for (const compositeKey of allChangedKeys) {
        const prodRow = neededProdRows.get(compositeKey);
        const devEntry = neededDevRows.get(compositeKey);

        if (!prodRow || !devEntry) continue;

        const { lineNum: devLineNum, row: devRow } = devEntry;
        const isMeaningful = meaningfulChangeKeys.has(compositeKey);
        let hasMeaningfulChange = false;
        const rowChanges: Array<{ column: string; oldValue: string; newValue: string }> = [];

        // Compare each column
        for (const key of commonKeys) {
          const prodVal = normalizeValue(prodRow[key] ?? '', this.caseSensitive, this.trimWhitespace);
          const devVal = normalizeValue(devRow[key] ?? '', this.caseSensitive, this.trimWhitespace);

          if (prodVal !== devVal) {
            const isExcluded = isExcludedColumn(key, this.excludedPatterns);

            // Only count meaningful columns in detailed_changes
            if (!isExcluded) {
              detailedChanges[key] = (detailedChanges[key] ?? 0) + 1;
              hasMeaningfulChange = true;
              // Collect the actual change (use original values, not normalized)
              rowChanges.push({
                column: key,
                oldValue: prodRow[key] ?? '',
                newValue: devRow[key] ?? '',
              });
            }
          }
        }

        // Collect example if meaningful
        if (isMeaningful && hasMeaningfulChange && examplesCollected < this.maxExamples) {
          const displayKey = getDisplayKey(devRow, this.primaryKeys);
          const prodEntry = prodIndex.get(compositeKey);

          if (prodEntry) {
            exampleIds[displayKey] = {
              prod_line_num: prodEntry.lineNum,
              dev_line_num: devLineNum,
              changes: rowChanges.slice(0, 5), // Limit to 5 changes per row for display
            };
            examplesCollected++;
          }
        }
      }
    }

    return {
      rows_added: rowsAdded,
      rows_removed: rowsRemoved,
      rows_updated: rowsChangedMeaningful,
      rows_updated_excluded_only: rowsChangedExcludedOnly,
      detailed_key_update_counts: detailedChanges,
      example_ids: exampleIds,
      example_ids_added: exampleIdsAdded,
      example_ids_removed: exampleIdsRemoved,
    };
  }
}

// ----- Convenience Functions -----

/**
 * Quick diff between two CSV files with default options.
 * Matches the Python API: `differ.compute_diff(prod_file, dev_file)`
 */
export function diffCSV(
  prodCsv: ParsedCSV,
  devCsv: ParsedCSV,
  options: Partial<DiffOptions> = {}
): DiffResult {
  // Auto-detect primary key if not provided
  const primaryKeys = options.primaryKeys ?? detectPrimaryKey(prodCsv);
  
  const differ = new EfficientDiffer({
    primaryKeys,
    maxExamples: options.maxExamples ?? DEFAULT_MAX_EXAMPLES,
    excludedPatterns: options.excludedPatterns ?? EXCLUDED_COLUMN_PATTERNS,
    caseSensitive: options.caseSensitive ?? true,
    trimWhitespace: options.trimWhitespace ?? true,
  });

  return differ.computeDiff(prodCsv, devCsv);
}

/**
 * Try to detect a suitable primary key column.
 * Uses common ID column names and uniqueness analysis.
 */
function detectPrimaryKey(csv: ParsedCSV): string[] {
  // Check common primary key column names first
  for (const name of COMMON_PRIMARY_KEY_NAMES) {
    if (csv.headers.includes(name)) {
      return [name];
    }
  }

  // Check for columns with high uniqueness
  for (const header of csv.headers) {
    const values = csv.rows.map(r => r[header] ?? '');
    const nonEmpty = values.filter(v => v !== '');
    if (nonEmpty.length === 0) continue;
    
    const uniqueCount = new Set(nonEmpty).size;
    if (uniqueCount / nonEmpty.length > PRIMARY_KEY_UNIQUENESS_THRESHOLD) {
      return [header];
    }
  }

  // Fall back to first column
  if (csv.headers.length > 0) {
    return [csv.headers[0]];
  }

  throw new Error('Cannot detect primary key - no columns available');
}

/**
 * Check if two CSVs are identical.
 */
export function areCSVsIdentical(
  prodCsv: ParsedCSV,
  devCsv: ParsedCSV,
  options: Partial<DiffOptions> = {}
): boolean {
  if (prodCsv.rowCount !== devCsv.rowCount) return false;
  if (prodCsv.headers.length !== devCsv.headers.length) return false;

  const result = diffCSV(prodCsv, devCsv, options);
  return (
    result.rows_added === 0 &&
    result.rows_removed === 0 &&
    result.rows_updated === 0 &&
    result.rows_updated_excluded_only === 0
  );
}

/**
 * Format diff summary for display.
 */
export function formatDiffSummary(result: DiffResult): string {
  const lines: string[] = [];

  lines.push(`Comparison: ${result.prod_row_count} rows vs ${result.dev_row_count} rows`);
  lines.push('');

  if (result.rows_added > 0) {
    lines.push(`+ ${result.rows_added} rows added`);
  }
  if (result.rows_removed > 0) {
    lines.push(`- ${result.rows_removed} rows removed`);
  }
  if (result.rows_updated > 0) {
    lines.push(`~ ${result.rows_updated} rows with meaningful changes`);
  }
  if (result.rows_updated_excluded_only > 0) {
    lines.push(`  (${result.rows_updated_excluded_only} rows with only inventory/availability changes)`);
  }

  // Show top changed columns
  const sortedChanges = Object.entries(result.detailed_key_update_counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (sortedChanges.length > 0) {
    lines.push('');
    lines.push('Top changed columns:');
    for (const [col, count] of sortedChanges) {
      lines.push(`  ${col}: ${count} changes`);
    }
  }

  return lines.join('\n');
}

/**
 * Export diff results as a CSV for detailed analysis.
 */
export function diffToCSV(
  result: DiffResult,
  prodCsv: ParsedCSV,
  devCsv: ParsedCSV
): ParsedCSV {
  const outputHeaders = ['_change_type', '_prod_line', '_dev_line', '_primary_key', ...result.common_keys];
  const rows: Record<string, string>[] = [];

  // We'd need the original data to build full export
  // For now, export the summary data we have
  
  // Added rows
  for (const [key, info] of Object.entries(result.example_ids_added)) {
    rows.push({
      _change_type: 'ADDED',
      _prod_line: '',
      _dev_line: String(info.dev_line_num),
      _primary_key: key,
    });
  }

  // Removed rows
  for (const [key, info] of Object.entries(result.example_ids_removed)) {
    rows.push({
      _change_type: 'REMOVED',
      _prod_line: String(info.prod_line_num),
      _dev_line: '',
      _primary_key: key,
    });
  }

  // Modified rows
  for (const [key, info] of Object.entries(result.example_ids)) {
    rows.push({
      _change_type: 'MODIFIED',
      _prod_line: String(info.prod_line_num),
      _dev_line: String(info.dev_line_num),
      _primary_key: key,
    });
  }

  return {
    headers: outputHeaders,
    rows,
    filename: 'diff-results.csv',
    rowCount: rows.length,
  };
}
