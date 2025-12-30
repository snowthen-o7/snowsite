// Core data structures for CSV operations

export interface ParsedCSV {
  headers: string[];
  rows: Record<string, string>[];
  filename: string;
  rowCount: number;
}

/**
 * Convert ParsedCSV rows to 2D array format on-demand.
 * Use this instead of storing rawData to save memory.
 */
export function toRawData(csv: ParsedCSV): string[][] {
  return csv.rows.map(row => csv.headers.map(h => row[h] || ''));
}

/**
 * Diff result matching Python's EfficientDiffer output format.
 * This ensures consistency between CLI tool and web UI.
 */
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

// Legacy types for backwards compatibility with simple diff views
export interface DiffRow {
  rowIndex: number;
  data: Record<string, string>;
}

export interface ModifiedRow {
  rowIndex: number;
  original: Record<string, string>;
  modified: Record<string, string>;
  changedFields: FieldChange[];
}

export interface FieldChange {
  field: string;
  oldValue: string;
  newValue: string;
}

export interface MergeOptions {
  keyColumn: string;
  strategy: 'left' | 'right' | 'outer' | 'inner';
  conflictResolution: 'keepLeft' | 'keepRight' | 'keepBoth';
}

export interface MergeResult {
  merged: ParsedCSV;
  conflicts: MergeConflict[];
  stats: MergeStats;
}

export interface MergeConflict {
  key: string;
  field: string;
  leftValue: string;
  rightValue: string;
  resolved: string;
}

export interface MergeStats {
  leftOnly: number;
  rightOnly: number;
  matched: number;
  conflicts: number;
}

export interface DedupeOptions {
  compareColumns: string[] | 'all';
  keepStrategy: 'first' | 'last';
  caseSensitive: boolean;
}

export interface DedupeResult {
  deduplicated: ParsedCSV;
  duplicatesRemoved: number;
  duplicateGroups: DuplicateGroup[];
}

export interface DuplicateGroup {
  key: string;
  rows: Record<string, string>[];
  kept: Record<string, string>;
}

export interface TransformOptions {
  filters: FilterRule[];
  selectedColumns: string[] | 'all';
  columnRenames: Record<string, string>;
  sortBy?: { column: string; direction: 'asc' | 'desc' };
}

export interface FilterRule {
  column: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'regex' | 'gt' | 'lt' | 'gte' | 'lte' | 'isEmpty' | 'isNotEmpty';
  value: string;
  negate: boolean;
}

export interface TransformResult {
  transformed: ParsedCSV;
  originalRowCount: number;
  filteredRowCount: number;
  columnsSelected: number;
}

// UI State types
export type TabId = 'diff' | 'merge' | 'dedupe' | 'transform';

export interface FileUploadState {
  file: File | null;
  parsed: ParsedCSV | null;
  error: string | null;
  loading: boolean;
}
