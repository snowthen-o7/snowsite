import { describe, it, expect } from 'vitest';
import { mergeCSV, suggestKeyColumns } from '../merge-engine';
import type { ParsedCSV } from '../../types/csv';

function createCSV(headers: string[], rows: Record<string, string>[]): ParsedCSV {
  return {
    headers,
    rows,
    filename: 'test.csv',
    rowCount: rows.length,
  };
}

describe('mergeCSV', () => {
  describe('join strategies', () => {
    const csvA = createCSV(['id', 'name'], [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ]);

    const csvB = createCSV(['id', 'email'], [
      { id: '2', email: 'bob@test.com' },
      { id: '3', email: 'charlie@test.com' },
    ]);

    it('performs inner join', () => {
      const result = mergeCSV(csvA, csvB, {
        keyColumn: 'id',
        strategy: 'inner',
      });

      expect(result.merged.rowCount).toBe(1);
      expect(result.merged.rows[0].id).toBe('2');
      expect(result.stats.matched).toBe(1);
    });

    it('performs left join', () => {
      const result = mergeCSV(csvA, csvB, {
        keyColumn: 'id',
        strategy: 'left',
      });

      expect(result.merged.rowCount).toBe(2);
      expect(result.stats.leftOnly).toBe(1);
      expect(result.stats.matched).toBe(1);
    });

    it('performs right join', () => {
      const result = mergeCSV(csvA, csvB, {
        keyColumn: 'id',
        strategy: 'right',
      });

      expect(result.merged.rowCount).toBe(2);
      expect(result.stats.rightOnly).toBe(1);
      expect(result.stats.matched).toBe(1);
    });

    it('performs outer join', () => {
      const result = mergeCSV(csvA, csvB, {
        keyColumn: 'id',
        strategy: 'outer',
      });

      expect(result.merged.rowCount).toBe(3);
      expect(result.stats.leftOnly).toBe(1);
      expect(result.stats.rightOnly).toBe(1);
      expect(result.stats.matched).toBe(1);
    });
  });

  describe('conflict resolution', () => {
    const csvA = createCSV(['id', 'status'], [{ id: '1', status: 'active' }]);
    const csvB = createCSV(['id', 'status'], [{ id: '1', status: 'inactive' }]);

    it('keeps left value on conflict', () => {
      const result = mergeCSV(csvA, csvB, {
        keyColumn: 'id',
        conflictResolution: 'keepLeft',
      });

      expect(result.merged.rows[0].status).toBe('active');
      expect(result.conflicts).toHaveLength(1);
    });

    it('keeps right value on conflict', () => {
      const result = mergeCSV(csvA, csvB, {
        keyColumn: 'id',
        conflictResolution: 'keepRight',
      });

      expect(result.merged.rows[0].status).toBe('inactive');
      expect(result.conflicts).toHaveLength(1);
    });

    it('keeps both values on conflict', () => {
      const result = mergeCSV(csvA, csvB, {
        keyColumn: 'id',
        conflictResolution: 'keepBoth',
      });

      expect(result.merged.rows[0].status).toBe('active | inactive');
      expect(result.conflicts).toHaveLength(1);
    });
  });

  describe('header handling', () => {
    it('combines headers from both files', () => {
      const csvA = createCSV(['id', 'name'], [{ id: '1', name: 'Alice' }]);
      const csvB = createCSV(['id', 'email'], [{ id: '1', email: 'a@test.com' }]);

      const result = mergeCSV(csvA, csvB, { keyColumn: 'id' });

      expect(result.merged.headers).toContain('id');
      expect(result.merged.headers).toContain('name');
      expect(result.merged.headers).toContain('email');
      expect(result.merged.headers[0]).toBe('id'); // Key column first
    });

    it('does not duplicate shared columns', () => {
      const csvA = createCSV(['id', 'name', 'shared'], [
        { id: '1', name: 'Alice', shared: 'a' },
      ]);
      const csvB = createCSV(['id', 'email', 'shared'], [
        { id: '1', email: 'a@test.com', shared: 'a' },
      ]);

      const result = mergeCSV(csvA, csvB, { keyColumn: 'id' });

      const sharedCount = result.merged.headers.filter((h) => h === 'shared').length;
      expect(sharedCount).toBe(1);
    });
  });

  describe('empty value handling', () => {
    it('fills from other file when one value is empty', () => {
      const csvA = createCSV(['id', 'name'], [{ id: '1', name: '' }]);
      const csvB = createCSV(['id', 'name'], [{ id: '1', name: 'Alice' }]);

      const result = mergeCSV(csvA, csvB, { keyColumn: 'id' });

      expect(result.merged.rows[0].name).toBe('Alice');
      expect(result.conflicts).toHaveLength(0);
    });

    it('does not create conflict when values are equal', () => {
      const csvA = createCSV(['id', 'name'], [{ id: '1', name: 'Alice' }]);
      const csvB = createCSV(['id', 'name'], [{ id: '1', name: 'Alice' }]);

      const result = mergeCSV(csvA, csvB, { keyColumn: 'id' });

      expect(result.conflicts).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('throws error when key column is not specified', () => {
      const csvA = createCSV(['id'], [{ id: '1' }]);
      const csvB = createCSV(['id'], [{ id: '1' }]);

      expect(() => mergeCSV(csvA, csvB, {})).toThrow('Key column is required');
    });

    it('throws error when key column not in first file', () => {
      const csvA = createCSV(['name'], [{ name: 'Alice' }]);
      const csvB = createCSV(['id', 'name'], [{ id: '1', name: 'Alice' }]);

      expect(() => mergeCSV(csvA, csvB, { keyColumn: 'id' })).toThrow(
        'Key column "id" not found in first file'
      );
    });

    it('throws error when key column not in second file', () => {
      const csvA = createCSV(['id', 'name'], [{ id: '1', name: 'Alice' }]);
      const csvB = createCSV(['name'], [{ name: 'Alice' }]);

      expect(() => mergeCSV(csvA, csvB, { keyColumn: 'id' })).toThrow(
        'Key column "id" not found in second file'
      );
    });
  });

  describe('statistics', () => {
    it('tracks conflict count correctly', () => {
      const csvA = createCSV(['id', 'a', 'b'], [
        { id: '1', a: 'x', b: 'y' },
        { id: '2', a: 'm', b: 'n' },
      ]);
      const csvB = createCSV(['id', 'a', 'b'], [
        { id: '1', a: 'X', b: 'Y' },
        { id: '2', a: 'M', b: 'N' },
      ]);

      const result = mergeCSV(csvA, csvB, { keyColumn: 'id' });

      expect(result.stats.conflicts).toBe(4); // 2 rows × 2 columns
      expect(result.conflicts).toHaveLength(4);
    });
  });
});

describe('suggestKeyColumns', () => {
  it('suggests columns with high uniqueness', () => {
    const csv = createCSV(['id', 'name', 'category'], [
      { id: '1', name: 'Alice', category: 'A' },
      { id: '2', name: 'Bob', category: 'A' },
      { id: '3', name: 'Charlie', category: 'B' },
      { id: '4', name: 'Diana', category: 'A' },
    ]);

    const suggestions = suggestKeyColumns(csv);

    expect(suggestions).toContain('id');
    expect(suggestions).toContain('name');
    expect(suggestions).not.toContain('category');
  });

  it('prioritizes common ID column names', () => {
    const csv = createCSV(['uuid', 'product_code'], [
      { uuid: 'a', product_code: '1' },
      { uuid: 'b', product_code: '2' },
      { uuid: 'c', product_code: '3' },
    ]);

    const suggestions = suggestKeyColumns(csv);

    // uuid should be prioritized as a common ID name
    expect(suggestions.indexOf('uuid')).toBeLessThanOrEqual(
      suggestions.indexOf('product_code')
    );
  });
});
