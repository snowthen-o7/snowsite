import type {
  ParsedCSV,
  MergeOptions,
  MergeResult,
  MergeConflict,
  MergeStats,
} from '../types/csv';
import { suggestPrimaryKeys as suggestPrimaryKeysFromParser } from './csv-parser';

const defaultMergeOptions: MergeOptions = {
  keyColumn: '',
  strategy: 'outer',
  conflictResolution: 'keepRight',
};

/**
 * Merge two CSV files based on a key column
 */
export function mergeCSV(
  csvA: ParsedCSV,
  csvB: ParsedCSV,
  options: Partial<MergeOptions> = {}
): MergeResult {
  const opts = { ...defaultMergeOptions, ...options };
  
  if (!opts.keyColumn) {
    throw new Error('Key column is required for merge operation');
  }

  // Validate key column exists in both
  if (!csvA.headers.includes(opts.keyColumn)) {
    throw new Error(`Key column "${opts.keyColumn}" not found in first file`);
  }
  if (!csvB.headers.includes(opts.keyColumn)) {
    throw new Error(`Key column "${opts.keyColumn}" not found in second file`);
  }

  // Determine output headers (union of both, key column first)
  const allHeaders = new Set([...csvA.headers, ...csvB.headers]);
  allHeaders.delete(opts.keyColumn);
  const outputHeaders = [opts.keyColumn, ...Array.from(allHeaders)];

  // Build lookup maps
  const mapA = new Map<string, Record<string, string>>();
  const mapB = new Map<string, Record<string, string>>();

  for (const row of csvA.rows) {
    const key = row[opts.keyColumn] || '';
    mapA.set(key, row);
  }

  for (const row of csvB.rows) {
    const key = row[opts.keyColumn] || '';
    mapB.set(key, row);
  }

  const allKeys = new Set([...mapA.keys(), ...mapB.keys()]);
  const mergedRows: Record<string, string>[] = [];
  const conflicts: MergeConflict[] = [];
  
  let leftOnly = 0;
  let rightOnly = 0;
  let matched = 0;

  for (const key of allKeys) {
    const rowA = mapA.get(key);
    const rowB = mapB.get(key);

    // Apply join strategy
    if (!rowA && opts.strategy === 'left') continue;
    if (!rowB && opts.strategy === 'right') continue;
    if ((!rowA || !rowB) && opts.strategy === 'inner') continue;

    if (rowA && !rowB) {
      leftOnly++;
      mergedRows.push(createMergedRow(rowA, null, outputHeaders, opts.keyColumn));
    } else if (!rowA && rowB) {
      rightOnly++;
      mergedRows.push(createMergedRow(null, rowB, outputHeaders, opts.keyColumn));
    } else if (rowA && rowB) {
      matched++;
      const { merged, rowConflicts } = mergeRows(
        rowA,
        rowB,
        outputHeaders,
        opts.keyColumn,
        opts.conflictResolution,
        key
      );
      mergedRows.push(merged);
      conflicts.push(...rowConflicts);
    }
  }

  const stats: MergeStats = {
    leftOnly,
    rightOnly,
    matched,
    conflicts: conflicts.length,
  };

  return {
    merged: {
      headers: outputHeaders,
      rows: mergedRows,
      filename: 'merged.csv',
      rowCount: mergedRows.length,
    },
    conflicts,
    stats,
  };
}

function createMergedRow(
  rowA: Record<string, string> | null,
  rowB: Record<string, string> | null,
  headers: string[],
  keyColumn: string
): Record<string, string> {
  const result: Record<string, string> = {};
  const source = rowA || rowB || {};

  for (const header of headers) {
    result[header] = source[header] || '';
  }

  return result;
}

function mergeRows(
  rowA: Record<string, string>,
  rowB: Record<string, string>,
  headers: string[],
  keyColumn: string,
  resolution: 'keepLeft' | 'keepRight' | 'keepBoth',
  key: string
): { merged: Record<string, string>; rowConflicts: MergeConflict[] } {
  const merged: Record<string, string> = {};
  const rowConflicts: MergeConflict[] = [];

  for (const header of headers) {
    const valueA = rowA[header] || '';
    const valueB = rowB[header] || '';

    if (header === keyColumn) {
      merged[header] = key;
    } else if (valueA === valueB) {
      merged[header] = valueA;
    } else if (valueA === '' && valueB !== '') {
      merged[header] = valueB;
    } else if (valueA !== '' && valueB === '') {
      merged[header] = valueA;
    } else {
      // True conflict - both have different non-empty values
      let resolved: string;
      switch (resolution) {
        case 'keepLeft':
          resolved = valueA;
          break;
        case 'keepRight':
          resolved = valueB;
          break;
        case 'keepBoth':
          resolved = `${valueA} | ${valueB}`;
          break;
      }

      merged[header] = resolved;
      rowConflicts.push({
        key,
        field: header,
        leftValue: valueA,
        rightValue: valueB,
        resolved,
      });
    }
  }

  return { merged, rowConflicts };
}

/**
 * Get suggested key columns (columns with high uniqueness)
 * Uses the shared implementation from csv-parser.
 */
export function suggestKeyColumns(csv: ParsedCSV): string[] {
  return suggestPrimaryKeysFromParser(csv);
}
