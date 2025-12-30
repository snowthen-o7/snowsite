/**
 * Configuration and constants for CSV Toolkit.
 * 
 * TypeScript port of data_diff_checker's config.py.
 * All configurable values are centralized here for easy customization.
 */

// ============================================================================
// DEFAULT VALUES
// ============================================================================

/** Maximum example IDs to include in diff output */
export const DEFAULT_MAX_EXAMPLES = 10;

/** Default primary key column */
export const DEFAULT_PRIMARY_KEY = 'id';

/**
 * Columns to exclude from "meaningful change" detection.
 * Changes to these columns won't be counted in rows_updated.
 * 
 * These patterns are checked case-insensitively against column names.
 * A column is excluded if its name CONTAINS any of these patterns.
 */
export const EXCLUDED_COLUMN_PATTERNS: string[] = [
  'inventory',
  'availability',
];

/**
 * Common primary key column names to try during auto-detection.
 * Checked in order - first match wins.
 */
export const COMMON_PRIMARY_KEY_NAMES: string[] = [
  'id',
  'ID',
  'Id',
  'sku',
  'SKU',
  'Sku',
  'uuid',
  'UUID',
  'key',
  'KEY',
  'product_id',
  'productId',
  'item_id',
  'itemId',
];

/** Uniqueness threshold for auto-detecting primary keys (95%) */
export const PRIMARY_KEY_UNIQUENESS_THRESHOLD = 0.95;

// ============================================================================
// TYPES
// ============================================================================

export interface DiffConfig {
  /** Column(s) that uniquely identify rows */
  primaryKeys: string[];
  /** Maximum example IDs to collect */
  maxExamples: number;
  /** Maximum rows to process (undefined = no limit) */
  maxRows?: number;
  /** Column patterns to exclude from meaningful changes */
  excludedPatterns: string[];
  /** Case sensitive comparison */
  caseSensitive: boolean;
  /** Trim whitespace before comparison */
  trimWhitespace: boolean;
}

export interface ParseConfig {
  /** CSV delimiter (auto-detected if not provided) */
  delimiter?: string;
  /** Whether first row is header */
  header: boolean;
  /** Skip empty lines */
  skipEmptyLines: boolean;
  /** Trim header names */
  trimHeaders: boolean;
  /** Convert numeric strings to numbers */
  dynamicTyping: boolean;
}

export interface MergeConfig {
  /** Column to join on */
  keyColumn: string;
  /** Join strategy */
  strategy: 'left' | 'right' | 'inner' | 'outer';
  /** How to resolve conflicting values */
  conflictResolution: 'keepLeft' | 'keepRight' | 'keepBoth';
}

export interface DedupeConfig {
  /** Columns to compare (or 'all') */
  compareColumns: string[] | 'all';
  /** Which duplicate to keep */
  keepStrategy: 'first' | 'last';
  /** Case sensitive comparison */
  caseSensitive: boolean;
}

export interface TransformConfig {
  /** Filter rules to apply */
  filters: FilterRule[];
  /** Columns to include in output */
  selectedColumns: string[] | 'all';
  /** Column rename mappings */
  columnRenames: Record<string, string>;
  /** Sort configuration */
  sortBy?: { column: string; direction: 'asc' | 'desc' };
}

export interface FilterRule {
  column: string;
  operator: FilterOperator;
  value: string;
  negate: boolean;
}

export type FilterOperator =
  | 'equals'
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'regex'
  | 'gt'
  | 'lt'
  | 'gte'
  | 'lte'
  | 'isEmpty'
  | 'isNotEmpty';

// ============================================================================
// DEFAULT CONFIGS
// ============================================================================

export const DEFAULT_DIFF_CONFIG: DiffConfig = {
  primaryKeys: [DEFAULT_PRIMARY_KEY],
  maxExamples: DEFAULT_MAX_EXAMPLES,
  maxRows: undefined,
  excludedPatterns: [...EXCLUDED_COLUMN_PATTERNS],
  caseSensitive: true,
  trimWhitespace: true,
};

export const DEFAULT_PARSE_CONFIG: ParseConfig = {
  delimiter: undefined, // Auto-detect
  header: true,
  skipEmptyLines: true,
  trimHeaders: true,
  dynamicTyping: false, // Keep as strings for consistent comparison
};

export const DEFAULT_MERGE_CONFIG: MergeConfig = {
  keyColumn: '',
  strategy: 'outer',
  conflictResolution: 'keepRight',
};

export const DEFAULT_DEDUPE_CONFIG: DedupeConfig = {
  compareColumns: 'all',
  keepStrategy: 'first',
  caseSensitive: true,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if a column should be excluded from meaningful change detection.
 */
export function isExcludedColumn(
  columnName: string,
  patterns: string[] = EXCLUDED_COLUMN_PATTERNS
): boolean {
  const colLower = columnName.toLowerCase();
  return patterns.some(pattern => colLower.includes(pattern.toLowerCase()));
}

/**
 * Create a DiffConfig from a comma-separated primary key string.
 * Matches Python's DiffConfig.from_primary_key_string()
 */
export function createDiffConfig(
  primaryKeyString: string,
  overrides: Partial<DiffConfig> = {}
): DiffConfig {
  const keys = primaryKeyString
    .split(',')
    .map(k => k.trim())
    .filter(Boolean);

  return {
    ...DEFAULT_DIFF_CONFIG,
    primaryKeys: keys.length > 0 ? keys : [DEFAULT_PRIMARY_KEY],
    ...overrides,
  };
}

/**
 * Merge partial config with defaults.
 */
export function mergeDiffConfig(partial: Partial<DiffConfig>): DiffConfig {
  return {
    ...DEFAULT_DIFF_CONFIG,
    ...partial,
    // Ensure arrays are properly merged
    primaryKeys: partial.primaryKeys ?? DEFAULT_DIFF_CONFIG.primaryKeys,
    excludedPatterns: partial.excludedPatterns ?? DEFAULT_DIFF_CONFIG.excludedPatterns,
  };
}
