import type {
  ParsedCSV,
  TransformOptions,
  TransformResult,
  FilterRule,
} from '../types/csv';

const defaultTransformOptions: TransformOptions = {
  filters: [],
  selectedColumns: 'all',
  columnRenames: {},
  sortBy: undefined,
};

/**
 * Check if a row matches a filter rule
 */
function matchesFilter(
  row: Record<string, string>,
  rule: FilterRule
): boolean {
  const value = row[rule.column] || '';
  let matches: boolean;

  switch (rule.operator) {
    case 'equals':
      matches = value === rule.value;
      break;
    case 'contains':
      matches = value.toLowerCase().includes(rule.value.toLowerCase());
      break;
    case 'startsWith':
      matches = value.toLowerCase().startsWith(rule.value.toLowerCase());
      break;
    case 'endsWith':
      matches = value.toLowerCase().endsWith(rule.value.toLowerCase());
      break;
    case 'regex':
      try {
        const regex = new RegExp(rule.value, 'i');
        matches = regex.test(value);
      } catch {
        matches = false;
      }
      break;
    case 'gt':
      matches = parseFloat(value) > parseFloat(rule.value);
      break;
    case 'lt':
      matches = parseFloat(value) < parseFloat(rule.value);
      break;
    case 'gte':
      matches = parseFloat(value) >= parseFloat(rule.value);
      break;
    case 'lte':
      matches = parseFloat(value) <= parseFloat(rule.value);
      break;
    case 'isEmpty':
      matches = value.trim() === '';
      break;
    case 'isNotEmpty':
      matches = value.trim() !== '';
      break;
    default:
      matches = true;
  }

  return rule.negate ? !matches : matches;
}

/**
 * Check if a row matches all filter rules (AND logic)
 */
function matchesAllFilters(
  row: Record<string, string>,
  filters: FilterRule[]
): boolean {
  if (filters.length === 0) return true;
  return filters.every((filter) => matchesFilter(row, filter));
}

/**
 * Compare function for sorting
 */
function compareValues(
  a: string,
  b: string,
  direction: 'asc' | 'desc'
): number {
  // Try numeric comparison first
  const numA = parseFloat(a);
  const numB = parseFloat(b);

  if (!isNaN(numA) && !isNaN(numB)) {
    return direction === 'asc' ? numA - numB : numB - numA;
  }

  // Fall back to string comparison
  const result = a.localeCompare(b, undefined, { sensitivity: 'base' });
  return direction === 'asc' ? result : -result;
}

/**
 * Transform a CSV with filters, column selection, and sorting
 */
export function transformCSV(
  csv: ParsedCSV,
  options: Partial<TransformOptions> = {}
): TransformResult {
  const opts = { ...defaultTransformOptions, ...options };

  // Step 1: Filter rows
  let filteredRows = csv.rows.filter((row) =>
    matchesAllFilters(row, opts.filters)
  );

  // Step 2: Sort if specified
  if (opts.sortBy) {
    const { column, direction } = opts.sortBy;
    filteredRows = [...filteredRows].sort((a, b) =>
      compareValues(a[column] || '', b[column] || '', direction)
    );
  }

  // Step 3: Select and rename columns
  const selectedColumns =
    opts.selectedColumns === 'all'
      ? csv.headers
      : opts.selectedColumns.filter((c) => csv.headers.includes(c));

  const outputHeaders = selectedColumns.map(
    (col) => opts.columnRenames[col] || col
  );

  // Step 4: Build output rows with selected/renamed columns
  const outputRows = filteredRows.map((row) => {
    const newRow: Record<string, string> = {};
    for (let i = 0; i < selectedColumns.length; i++) {
      const originalCol = selectedColumns[i];
      const newCol = outputHeaders[i];
      newRow[newCol] = row[originalCol] || '';
    }
    return newRow;
  });

  return {
    transformed: {
      headers: outputHeaders,
      rows: outputRows,
      filename: `transformed-${csv.filename}`,
      rowCount: outputRows.length,
    },
    originalRowCount: csv.rowCount,
    filteredRowCount: outputRows.length,
    columnsSelected: selectedColumns.length,
  };
}

/**
 * Preview filter results without full transformation
 */
export function previewFilter(
  csv: ParsedCSV,
  filters: FilterRule[]
): { matchCount: number; sampleMatches: Record<string, string>[] } {
  const matches = csv.rows.filter((row) => matchesAllFilters(row, filters));

  return {
    matchCount: matches.length,
    sampleMatches: matches.slice(0, 5),
  };
}

/**
 * Get unique values for a column (for filter autocomplete)
 */
export function getColumnValues(
  csv: ParsedCSV,
  column: string,
  limit: number = 100
): string[] {
  const values = new Set<string>();

  for (const row of csv.rows) {
    const value = row[column];
    if (value !== undefined && value !== '') {
      values.add(value);
      if (values.size >= limit) break;
    }
  }

  return Array.from(values).sort();
}

/**
 * Infer column types for better filter suggestions
 */
export function inferColumnType(
  csv: ParsedCSV,
  column: string
): 'number' | 'date' | 'boolean' | 'string' {
  const sampleSize = Math.min(100, csv.rowCount);
  const samples = csv.rows.slice(0, sampleSize).map((r) => r[column] || '');

  // Check if all non-empty values are numbers
  const nonEmpty = samples.filter((s) => s.trim() !== '');
  if (nonEmpty.length === 0) return 'string';

  const allNumbers = nonEmpty.every((s) => !isNaN(parseFloat(s)));
  if (allNumbers) return 'number';

  // Check for boolean-like values
  const boolValues = new Set(['true', 'false', 'yes', 'no', '1', '0', 'y', 'n']);
  const allBool = nonEmpty.every((s) => boolValues.has(s.toLowerCase()));
  if (allBool) return 'boolean';

  // Check for date-like patterns
  const datePattern = /^\d{4}-\d{2}-\d{2}|^\d{1,2}\/\d{1,2}\/\d{2,4}/;
  const likelyDates = nonEmpty.filter((s) => datePattern.test(s)).length;
  if (likelyDates / nonEmpty.length > 0.8) return 'date';

  return 'string';
}

/**
 * Create a filter rule helper
 */
export function createFilter(
  column: string,
  operator: FilterRule['operator'],
  value: string = '',
  negate: boolean = false
): FilterRule {
  return { column, operator, value, negate };
}
