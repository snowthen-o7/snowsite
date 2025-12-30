import type {
  ParsedCSV,
  DedupeOptions,
  DedupeResult,
  DuplicateGroup,
} from '../types/csv';

const defaultDedupeOptions: DedupeOptions = {
  compareColumns: 'all',
  keepStrategy: 'first',
  caseSensitive: true,
};

/**
 * Create a comparison key for a row
 */
function createCompareKey(
  row: Record<string, string>,
  columns: string[],
  caseSensitive: boolean
): string {
  return columns
    .map((col) => {
      let value = row[col] || '';
      if (!caseSensitive) value = value.toLowerCase();
      return value.trim();
    })
    .join('|');
}

/**
 * Remove duplicate rows from a CSV
 */
export function dedupeCSV(
  csv: ParsedCSV,
  options: Partial<DedupeOptions> = {}
): DedupeResult {
  const opts = { ...defaultDedupeOptions, ...options };
  
  const compareColumns =
    opts.compareColumns === 'all'
      ? csv.headers
      : opts.compareColumns.filter((c) => csv.headers.includes(c));

  if (compareColumns.length === 0) {
    throw new Error('No valid columns to compare');
  }

  // Group rows by their comparison key
  const groups = new Map<string, Record<string, string>[]>();

  for (const row of csv.rows) {
    const key = createCompareKey(row, compareColumns, opts.caseSensitive);
    const existing = groups.get(key) || [];
    existing.push(row);
    groups.set(key, existing);
  }

  // Build deduplicated result
  const deduplicatedRows: Record<string, string>[] = [];
  const duplicateGroups: DuplicateGroup[] = [];

  for (const [key, rows] of groups) {
    // Select which row to keep
    const kept = opts.keepStrategy === 'first' ? rows[0] : rows[rows.length - 1];
    deduplicatedRows.push(kept);

    // Track duplicate groups (only if there were actual duplicates)
    if (rows.length > 1) {
      duplicateGroups.push({
        key,
        rows,
        kept,
      });
    }
  }

  const duplicatesRemoved = csv.rowCount - deduplicatedRows.length;

  return {
    deduplicated: {
      headers: csv.headers,
      rows: deduplicatedRows,
      filename: `deduped-${csv.filename}`,
      rowCount: deduplicatedRows.length,
    },
    duplicatesRemoved,
    duplicateGroups,
  };
}

/**
 * Find duplicates without removing them (preview mode)
 */
export function findDuplicates(
  csv: ParsedCSV,
  options: Partial<DedupeOptions> = {}
): DuplicateGroup[] {
  const opts = { ...defaultDedupeOptions, ...options };
  
  const compareColumns =
    opts.compareColumns === 'all'
      ? csv.headers
      : opts.compareColumns.filter((c) => csv.headers.includes(c));

  const groups = new Map<string, Record<string, string>[]>();

  for (const row of csv.rows) {
    const key = createCompareKey(row, compareColumns, opts.caseSensitive);
    const existing = groups.get(key) || [];
    existing.push(row);
    groups.set(key, existing);
  }

  // Return only groups with duplicates
  const duplicateGroups: DuplicateGroup[] = [];

  for (const [key, rows] of groups) {
    if (rows.length > 1) {
      const kept = opts.keepStrategy === 'first' ? rows[0] : rows[rows.length - 1];
      duplicateGroups.push({
        key,
        rows,
        kept,
      });
    }
  }

  return duplicateGroups;
}

/**
 * Get statistics about potential duplicates
 */
export function getDuplicateStats(
  csv: ParsedCSV,
  options: Partial<DedupeOptions> = {}
): {
  totalRows: number;
  uniqueRows: number;
  duplicateRows: number;
  duplicateGroups: number;
  largestGroup: number;
} {
  const duplicates = findDuplicates(csv, options);

  const duplicateRowCount = duplicates.reduce(
    (sum, group) => sum + group.rows.length - 1, // -1 because one row is kept
    0
  );

  const largestGroup = duplicates.reduce(
    (max, group) => Math.max(max, group.rows.length),
    0
  );

  return {
    totalRows: csv.rowCount,
    uniqueRows: csv.rowCount - duplicateRowCount,
    duplicateRows: duplicateRowCount,
    duplicateGroups: duplicates.length,
    largestGroup,
  };
}
