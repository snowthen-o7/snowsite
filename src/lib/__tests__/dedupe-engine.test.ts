import { describe, it, expect } from 'vitest';
import { dedupeCSV, findDuplicates, getDuplicateStats } from '../dedupe-engine';
import type { ParsedCSV } from '../../types/csv';

function createCSV(headers: string[], rows: Record<string, string>[]): ParsedCSV {
  return {
    headers,
    rows,
    filename: 'test.csv',
    rowCount: rows.length,
  };
}

describe('dedupeCSV', () => {
  it('removes exact duplicate rows', () => {
    const csv = createCSV(['id', 'name'], [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
      { id: '1', name: 'Alice' },
      { id: '3', name: 'Charlie' },
    ]);

    const result = dedupeCSV(csv);

    expect(result.duplicatesRemoved).toBe(1);
    expect(result.deduplicated.rowCount).toBe(3);
    expect(result.duplicateGroups).toHaveLength(1);
  });

  it('returns empty result for csv with no duplicates', () => {
    const csv = createCSV(['id', 'name'], [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
      { id: '3', name: 'Charlie' },
    ]);

    const result = dedupeCSV(csv);

    expect(result.duplicatesRemoved).toBe(0);
    expect(result.deduplicated.rowCount).toBe(3);
    expect(result.duplicateGroups).toHaveLength(0);
  });

  it('keeps first occurrence by default', () => {
    const csv = createCSV(['id', 'name', 'value'], [
      { id: '1', name: 'Alice', value: 'first' },
      { id: '1', name: 'Alice', value: 'second' },
    ]);

    const result = dedupeCSV(csv, { keepStrategy: 'first' });

    expect(result.deduplicated.rows[0].value).toBe('first');
  });

  it('keeps last occurrence when specified', () => {
    const csv = createCSV(['id', 'name', 'value'], [
      { id: '1', name: 'Alice', value: 'first' },
      { id: '1', name: 'Alice', value: 'second' },
    ]);

    // Compare only id and name so the rows are considered duplicates
    const result = dedupeCSV(csv, {
      keepStrategy: 'last',
      compareColumns: ['id', 'name'],
    });

    expect(result.deduplicated.rows[0].value).toBe('second');
  });

  it('compares only selected columns when specified', () => {
    const csv = createCSV(['id', 'name', 'value'], [
      { id: '1', name: 'Alice', value: 'a' },
      { id: '1', name: 'Alice', value: 'b' },
      { id: '2', name: 'Bob', value: 'c' },
    ]);

    const result = dedupeCSV(csv, { compareColumns: ['id', 'name'] });

    expect(result.duplicatesRemoved).toBe(1);
    expect(result.deduplicated.rowCount).toBe(2);
  });

  it('handles case-insensitive comparison', () => {
    const csv = createCSV(['name'], [
      { name: 'Alice' },
      { name: 'ALICE' },
      { name: 'alice' },
    ]);

    const result = dedupeCSV(csv, { caseSensitive: false });

    expect(result.duplicatesRemoved).toBe(2);
    expect(result.deduplicated.rowCount).toBe(1);
  });

  it('treats case-sensitive by default', () => {
    const csv = createCSV(['name'], [
      { name: 'Alice' },
      { name: 'ALICE' },
      { name: 'alice' },
    ]);

    const result = dedupeCSV(csv);

    expect(result.duplicatesRemoved).toBe(0);
    expect(result.deduplicated.rowCount).toBe(3);
  });

  it('handles empty CSV', () => {
    const csv = createCSV(['id', 'name'], []);

    const result = dedupeCSV(csv);

    expect(result.duplicatesRemoved).toBe(0);
    expect(result.deduplicated.rowCount).toBe(0);
  });

  it('throws error when no valid columns to compare', () => {
    const csv = createCSV(['id', 'name'], [{ id: '1', name: 'Alice' }]);

    expect(() => dedupeCSV(csv, { compareColumns: ['invalid'] })).toThrow(
      'No valid columns to compare'
    );
  });

  it('tracks duplicate groups correctly', () => {
    const csv = createCSV(['id'], [
      { id: '1' },
      { id: '1' },
      { id: '1' },
      { id: '2' },
      { id: '2' },
    ]);

    const result = dedupeCSV(csv);

    expect(result.duplicateGroups).toHaveLength(2);
    expect(result.duplicateGroups[0].rows).toHaveLength(3);
    expect(result.duplicateGroups[1].rows).toHaveLength(2);
  });
});

describe('findDuplicates', () => {
  it('returns only groups with duplicates', () => {
    const csv = createCSV(['id'], [
      { id: '1' },
      { id: '1' },
      { id: '2' },
      { id: '3' },
    ]);

    const groups = findDuplicates(csv);

    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('1');
    expect(groups[0].rows).toHaveLength(2);
  });

  it('returns empty array when no duplicates', () => {
    const csv = createCSV(['id'], [{ id: '1' }, { id: '2' }, { id: '3' }]);

    const groups = findDuplicates(csv);

    expect(groups).toHaveLength(0);
  });
});

describe('getDuplicateStats', () => {
  it('returns correct statistics', () => {
    const csv = createCSV(['id'], [
      { id: '1' },
      { id: '1' },
      { id: '1' },
      { id: '2' },
      { id: '2' },
      { id: '3' },
    ]);

    const stats = getDuplicateStats(csv);

    expect(stats.totalRows).toBe(6);
    expect(stats.uniqueRows).toBe(3);
    expect(stats.duplicateRows).toBe(3);
    expect(stats.duplicateGroups).toBe(2);
    expect(stats.largestGroup).toBe(3);
  });

  it('handles no duplicates', () => {
    const csv = createCSV(['id'], [{ id: '1' }, { id: '2' }]);

    const stats = getDuplicateStats(csv);

    expect(stats.totalRows).toBe(2);
    expect(stats.uniqueRows).toBe(2);
    expect(stats.duplicateRows).toBe(0);
    expect(stats.duplicateGroups).toBe(0);
    expect(stats.largestGroup).toBe(0);
  });
});
