import { describe, it, expect } from 'vitest';
import {
  EfficientDiffer,
  diffCSV,
  areCSVsIdentical,
  formatDiffSummary,
} from '../diff-engine';
import type { ParsedCSV } from '../../types/csv';

function createCSV(headers: string[], rows: Record<string, string>[]): ParsedCSV {
  return {
    headers,
    rows,
    filename: 'test.csv',
    rowCount: rows.length,
  };
}

describe('EfficientDiffer', () => {
  describe('computeDiff', () => {
    it('detects added rows', () => {
      const prod = createCSV(['id', 'name'], [
        { id: '1', name: 'Alice' },
        { id: '2', name: 'Bob' },
      ]);

      const dev = createCSV(['id', 'name'], [
        { id: '1', name: 'Alice' },
        { id: '2', name: 'Bob' },
        { id: '3', name: 'Charlie' },
      ]);

      const differ = new EfficientDiffer({ primaryKeys: ['id'] });
      const result = differ.computeDiff(prod, dev);

      expect(result.rows_added).toBe(1);
      expect(result.rows_removed).toBe(0);
      expect(result.rows_updated).toBe(0);
    });

    it('detects removed rows', () => {
      const prod = createCSV(['id', 'name'], [
        { id: '1', name: 'Alice' },
        { id: '2', name: 'Bob' },
        { id: '3', name: 'Charlie' },
      ]);

      const dev = createCSV(['id', 'name'], [
        { id: '1', name: 'Alice' },
        { id: '2', name: 'Bob' },
      ]);

      const differ = new EfficientDiffer({ primaryKeys: ['id'] });
      const result = differ.computeDiff(prod, dev);

      expect(result.rows_added).toBe(0);
      expect(result.rows_removed).toBe(1);
      expect(result.rows_updated).toBe(0);
    });

    it('detects modified rows', () => {
      const prod = createCSV(['id', 'name', 'email'], [
        { id: '1', name: 'Alice', email: 'alice@old.com' },
        { id: '2', name: 'Bob', email: 'bob@test.com' },
      ]);

      const dev = createCSV(['id', 'name', 'email'], [
        { id: '1', name: 'Alice', email: 'alice@new.com' },
        { id: '2', name: 'Bob', email: 'bob@test.com' },
      ]);

      const differ = new EfficientDiffer({ primaryKeys: ['id'] });
      const result = differ.computeDiff(prod, dev);

      expect(result.rows_added).toBe(0);
      expect(result.rows_removed).toBe(0);
      expect(result.rows_updated).toBe(1);
      expect(result.detailed_key_update_counts['email']).toBe(1);
    });

    it('handles composite primary keys', () => {
      const prod = createCSV(['sku', 'locale', 'price'], [
        { sku: 'ABC', locale: 'en', price: '10' },
        { sku: 'ABC', locale: 'fr', price: '12' },
      ]);

      const dev = createCSV(['sku', 'locale', 'price'], [
        { sku: 'ABC', locale: 'en', price: '10' },
        { sku: 'ABC', locale: 'fr', price: '15' },
      ]);

      const differ = new EfficientDiffer({ primaryKeys: ['sku', 'locale'] });
      const result = differ.computeDiff(prod, dev);

      expect(result.rows_updated).toBe(1);
      expect(result.detailed_key_update_counts['price']).toBe(1);
    });

    it('separates excluded column changes', () => {
      const prod = createCSV(['id', 'name', 'inventory'], [
        { id: '1', name: 'Widget', inventory: '100' },
      ]);

      const dev = createCSV(['id', 'name', 'inventory'], [
        { id: '1', name: 'Widget', inventory: '50' },
      ]);

      const differ = new EfficientDiffer({
        primaryKeys: ['id'],
        excludedPatterns: ['inventory'],
      });
      const result = differ.computeDiff(prod, dev);

      expect(result.rows_updated).toBe(0);
      expect(result.rows_updated_excluded_only).toBe(1);
    });

    it('handles case-insensitive comparison', () => {
      const prod = createCSV(['id', 'name'], [{ id: '1', name: 'Alice' }]);
      const dev = createCSV(['id', 'name'], [{ id: '1', name: 'ALICE' }]);

      const caseSensitive = new EfficientDiffer({
        primaryKeys: ['id'],
        caseSensitive: true,
      });
      const caseInsensitive = new EfficientDiffer({
        primaryKeys: ['id'],
        caseSensitive: false,
      });

      expect(caseSensitive.computeDiff(prod, dev).rows_updated).toBe(1);
      expect(caseInsensitive.computeDiff(prod, dev).rows_updated).toBe(0);
    });

    it('handles whitespace trimming', () => {
      const prod = createCSV(['id', 'name'], [{ id: '1', name: 'Alice' }]);
      const dev = createCSV(['id', 'name'], [{ id: '1', name: '  Alice  ' }]);

      const withTrim = new EfficientDiffer({
        primaryKeys: ['id'],
        trimWhitespace: true,
      });
      const withoutTrim = new EfficientDiffer({
        primaryKeys: ['id'],
        trimWhitespace: false,
      });

      expect(withTrim.computeDiff(prod, dev).rows_updated).toBe(0);
      expect(withoutTrim.computeDiff(prod, dev).rows_updated).toBe(1);
    });

    it('detects column differences between files', () => {
      const prod = createCSV(['id', 'name', 'old_col'], [
        { id: '1', name: 'Alice', old_col: 'x' },
      ]);

      const dev = createCSV(['id', 'name', 'new_col'], [
        { id: '1', name: 'Alice', new_col: 'y' },
      ]);

      const differ = new EfficientDiffer({ primaryKeys: ['id'] });
      const result = differ.computeDiff(prod, dev);

      expect(result.prod_only_keys).toContain('old_col');
      expect(result.dev_only_keys).toContain('new_col');
      expect(result.common_keys).toContain('id');
      expect(result.common_keys).toContain('name');
    });

    it('throws error when primary key not found', () => {
      const prod = createCSV(['name'], [{ name: 'Alice' }]);
      const dev = createCSV(['name'], [{ name: 'Alice' }]);

      const differ = new EfficientDiffer({ primaryKeys: ['id'] });

      expect(() => differ.computeDiff(prod, dev)).toThrow(/Primary keys.*not found/);
    });

    it('handles empty CSVs', () => {
      const prod = createCSV(['id', 'name'], []);
      const dev = createCSV(['id', 'name'], []);

      const differ = new EfficientDiffer({ primaryKeys: ['id'] });
      const result = differ.computeDiff(prod, dev);

      expect(result.rows_added).toBe(0);
      expect(result.rows_removed).toBe(0);
      expect(result.prod_row_count).toBe(0);
      expect(result.dev_row_count).toBe(0);
    });

    it('collects example changes with line numbers', () => {
      const prod = createCSV(['id', 'name'], [
        { id: '1', name: 'Alice' },
        { id: '2', name: 'Bob' },
      ]);

      const dev = createCSV(['id', 'name'], [
        { id: '1', name: 'Alicia' },
        { id: '2', name: 'Bob' },
      ]);

      const differ = new EfficientDiffer({ primaryKeys: ['id'], maxExamples: 5 });
      const result = differ.computeDiff(prod, dev);

      expect(Object.keys(result.example_ids)).toHaveLength(1);
      const example = result.example_ids['1'];
      expect(example.prod_line_num).toBe(1);
      expect(example.dev_line_num).toBe(1);
      expect(example.changes[0].column).toBe('name');
      expect(example.changes[0].oldValue).toBe('Alice');
      expect(example.changes[0].newValue).toBe('Alicia');
    });
  });
});

describe('diffCSV', () => {
  it('auto-detects primary key', () => {
    const prod = createCSV(['id', 'name'], [{ id: '1', name: 'Alice' }]);
    const dev = createCSV(['id', 'name'], [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ]);

    const result = diffCSV(prod, dev);

    expect(result.rows_added).toBe(1);
  });

  it('uses provided primary key', () => {
    const prod = createCSV(['sku', 'name'], [{ sku: 'A1', name: 'Widget' }]);
    const dev = createCSV(['sku', 'name'], [{ sku: 'A1', name: 'Gadget' }]);

    const result = diffCSV(prod, dev, { primaryKeys: ['sku'] });

    expect(result.rows_updated).toBe(1);
  });
});

describe('areCSVsIdentical', () => {
  it('returns true for identical CSVs', () => {
    const csv1 = createCSV(['id', 'name'], [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ]);

    const csv2 = createCSV(['id', 'name'], [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ]);

    expect(areCSVsIdentical(csv1, csv2, { primaryKeys: ['id'] })).toBe(true);
  });

  it('returns false when rows differ', () => {
    const csv1 = createCSV(['id', 'name'], [{ id: '1', name: 'Alice' }]);
    const csv2 = createCSV(['id', 'name'], [{ id: '1', name: 'Bob' }]);

    expect(areCSVsIdentical(csv1, csv2, { primaryKeys: ['id'] })).toBe(false);
  });

  it('returns false when row counts differ', () => {
    const csv1 = createCSV(['id'], [{ id: '1' }]);
    const csv2 = createCSV(['id'], [{ id: '1' }, { id: '2' }]);

    expect(areCSVsIdentical(csv1, csv2, { primaryKeys: ['id'] })).toBe(false);
  });
});

describe('formatDiffSummary', () => {
  it('formats diff summary correctly', () => {
    const result = {
      rows_added: 5,
      rows_removed: 3,
      rows_updated: 10,
      rows_updated_excluded_only: 2,
      detailed_key_update_counts: { name: 7, price: 3 },
      example_ids: {},
      example_ids_added: {},
      example_ids_removed: {},
      common_keys: ['id', 'name', 'price'],
      prod_only_keys: [],
      dev_only_keys: [],
      prod_row_count: 100,
      dev_row_count: 102,
    };

    const summary = formatDiffSummary(result);

    expect(summary).toContain('100 rows vs 102 rows');
    expect(summary).toContain('5 rows added');
    expect(summary).toContain('3 rows removed');
    expect(summary).toContain('10 rows with meaningful changes');
    expect(summary).toContain('name: 7 changes');
  });
});
