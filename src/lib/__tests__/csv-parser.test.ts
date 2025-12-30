import { describe, it, expect } from 'vitest';
import {
  parseCSVString,
  detectCSVFormat,
  toCSVString,
  getColumnStats,
  suggestPrimaryKeys,
  validateRequiredColumns,
  normalizeCSV,
} from '../csv-parser';
import type { ParsedCSV } from '../../types/csv';

function createCSV(headers: string[], rows: Record<string, string>[]): ParsedCSV {
  return {
    headers,
    rows,
    filename: 'test.csv',
    rowCount: rows.length,
  };
}

describe('parseCSVString', () => {
  it('parses simple CSV', () => {
    const content = `id,name,email
1,Alice,alice@test.com
2,Bob,bob@test.com`;

    const result = parseCSVString(content);

    expect(result.headers).toEqual(['id', 'name', 'email']);
    expect(result.rowCount).toBe(2);
    expect(result.rows[0]).toEqual({ id: '1', name: 'Alice', email: 'alice@test.com' });
  });

  it('handles quoted fields', () => {
    const content = `name,description
"Widget","A simple, useful widget"
"Gadget","Has ""special"" features"`;

    const result = parseCSVString(content);

    expect(result.rows[0].description).toBe('A simple, useful widget');
    expect(result.rows[1].description).toBe('Has "special" features');
  });

  it('handles different delimiters', () => {
    const content = `id;name;value
1;Alice;100
2;Bob;200`;

    const result = parseCSVString(content);

    expect(result.headers).toEqual(['id', 'name', 'value']);
    expect(result.rows[0].id).toBe('1');
  });

  it('handles tab-delimited files', () => {
    const content = `id\tname\tvalue
1\tAlice\t100`;

    const result = parseCSVString(content);

    expect(result.headers).toEqual(['id', 'name', 'value']);
    expect(result.rows[0].name).toBe('Alice');
  });

  it('skips empty lines by default', () => {
    const content = `id,name
1,Alice

2,Bob

`;

    const result = parseCSVString(content);

    expect(result.rowCount).toBe(2);
  });

  it('trims header names by default', () => {
    const content = `  id  ,  name
1,Alice`;

    const result = parseCSVString(content);

    expect(result.headers).toEqual(['id', 'name']);
  });

  it('uses provided filename', () => {
    const content = `id\n1`;
    const result = parseCSVString(content, 'my-data.csv');

    expect(result.filename).toBe('my-data.csv');
  });

  it('handles empty CSV', () => {
    const content = `id,name`;
    const result = parseCSVString(content);

    expect(result.headers).toEqual(['id', 'name']);
    expect(result.rowCount).toBe(0);
  });

  it('handles fields with newlines', () => {
    const content = `id,description
1,"Line 1
Line 2"`;

    const result = parseCSVString(content);

    expect(result.rows[0].description).toBe('Line 1\nLine 2');
  });
});

describe('detectCSVFormat', () => {
  it('detects comma delimiter', () => {
    const content = `a,b,c
1,2,3`;

    const format = detectCSVFormat(content);

    expect(format.delimiter).toBe(',');
    expect(format.columnCount).toBe(3);
  });

  it('detects semicolon delimiter', () => {
    const content = `a;b;c
1;2;3`;

    const format = detectCSVFormat(content);

    expect(format.delimiter).toBe(';');
  });

  it('detects tab delimiter', () => {
    const content = `a\tb\tc
1\t2\t3`;

    const format = detectCSVFormat(content);

    expect(format.delimiter).toBe('\t');
  });
});

describe('toCSVString', () => {
  it('converts ParsedCSV back to string', () => {
    const csv = createCSV(['id', 'name'], [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ]);

    const result = toCSVString(csv);

    expect(result).toContain('id,name');
    expect(result).toContain('1,Alice');
    expect(result).toContain('2,Bob');
  });

  it('uses custom delimiter', () => {
    const csv = createCSV(['a', 'b'], [{ a: '1', b: '2' }]);

    const result = toCSVString(csv, ';');

    expect(result).toContain('a;b');
    expect(result).toContain('1;2');
  });

  it('quotes fields with special characters', () => {
    const csv = createCSV(['name'], [{ name: 'Hello, World' }]);

    const result = toCSVString(csv);

    expect(result).toContain('"Hello, World"');
  });
});

describe('getColumnStats', () => {
  it('returns correct statistics', () => {
    const csv = createCSV(['category'], [
      { category: 'A' },
      { category: 'B' },
      { category: 'A' },
      { category: '' },
    ]);

    const stats = getColumnStats(csv, 'category');

    expect(stats.uniqueValues).toBe(3); // A, B, empty
    expect(stats.emptyCount).toBe(1);
    expect(stats.sampleValues).toContain('A');
    expect(stats.sampleValues).toContain('B');
  });

  it('infers number type', () => {
    const csv = createCSV(['price'], [
      { price: '10' },
      { price: '20.5' },
      { price: '30' },
    ]);

    const stats = getColumnStats(csv, 'price');

    expect(stats.inferredType).toBe('number');
  });

  it('infers boolean type', () => {
    const csv = createCSV(['active'], [
      { active: 'true' },
      { active: 'false' },
      { active: 'yes' },
    ]);

    const stats = getColumnStats(csv, 'active');

    expect(stats.inferredType).toBe('boolean');
  });

  it('infers date type', () => {
    const csv = createCSV(['date'], [
      { date: '2024-01-01' },
      { date: '2024-02-15' },
      { date: '2024-03-20' },
    ]);

    const stats = getColumnStats(csv, 'date');

    expect(stats.inferredType).toBe('date');
  });

  it('falls back to string type', () => {
    const csv = createCSV(['name'], [{ name: 'Alice' }, { name: 'Bob' }]);

    const stats = getColumnStats(csv, 'name');

    expect(stats.inferredType).toBe('string');
  });
});

describe('suggestPrimaryKeys', () => {
  it('suggests columns with high uniqueness', () => {
    const csv = createCSV(['id', 'name', 'category'], [
      { id: '1', name: 'Alice', category: 'A' },
      { id: '2', name: 'Bob', category: 'A' },
      { id: '3', name: 'Charlie', category: 'B' },
    ]);

    const suggestions = suggestPrimaryKeys(csv);

    expect(suggestions).toContain('id');
    expect(suggestions).toContain('name');
  });

  it('prioritizes common ID column names', () => {
    const csv = createCSV(['code', 'id'], [
      { code: 'A', id: '1' },
      { code: 'B', id: '2' },
      { code: 'C', id: '3' },
    ]);

    const suggestions = suggestPrimaryKeys(csv);

    expect(suggestions.indexOf('id')).toBeLessThan(suggestions.indexOf('code'));
  });

  it('excludes columns with low uniqueness', () => {
    const csv = createCSV(['id', 'status'], [
      { id: '1', status: 'active' },
      { id: '2', status: 'active' },
      { id: '3', status: 'active' },
      { id: '4', status: 'inactive' },
    ]);

    const suggestions = suggestPrimaryKeys(csv);

    expect(suggestions).not.toContain('status');
  });

  it('handles empty values', () => {
    const csv = createCSV(['id', 'optional'], [
      { id: '1', optional: '' },
      { id: '2', optional: '' },
      { id: '3', optional: 'value' },
    ]);

    const suggestions = suggestPrimaryKeys(csv);

    expect(suggestions).toContain('id');
  });
});

describe('validateRequiredColumns', () => {
  it('returns valid when all columns present', () => {
    const csv = createCSV(['id', 'name', 'email'], []);

    const result = validateRequiredColumns(csv, ['id', 'name']);

    expect(result.valid).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it('returns invalid when columns missing', () => {
    const csv = createCSV(['id', 'name'], []);

    const result = validateRequiredColumns(csv, ['id', 'email', 'phone']);

    expect(result.valid).toBe(false);
    expect(result.missing).toContain('email');
    expect(result.missing).toContain('phone');
  });

  it('performs case-insensitive check', () => {
    const csv = createCSV(['ID', 'Name'], []);

    const result = validateRequiredColumns(csv, ['id', 'name']);

    expect(result.valid).toBe(true);
  });
});

describe('normalizeCSV', () => {
  it('trims values by default', () => {
    const csv = createCSV(['name'], [{ name: '  Alice  ' }]);

    const result = normalizeCSV(csv);

    expect(result.rows[0].name).toBe('Alice');
  });

  it('lowercases values when specified', () => {
    const csv = createCSV(['name'], [{ name: 'ALICE' }]);

    const result = normalizeCSV(csv, { lowercase: true });

    expect(result.rows[0].name).toBe('alice');
  });

  it('sorts by column when specified', () => {
    const csv = createCSV(['name'], [
      { name: 'Charlie' },
      { name: 'Alice' },
      { name: 'Bob' },
    ]);

    const result = normalizeCSV(csv, { sortByColumn: 'name' });

    expect(result.rows[0].name).toBe('Alice');
    expect(result.rows[1].name).toBe('Bob');
    expect(result.rows[2].name).toBe('Charlie');
  });

  it('preserves original csv properties', () => {
    const csv = createCSV(['name'], [{ name: 'Alice' }]);
    csv.filename = 'original.csv';

    const result = normalizeCSV(csv);

    expect(result.filename).toBe('original.csv');
    expect(result.headers).toEqual(['name']);
  });

  it('handles empty values', () => {
    const csv = createCSV(['name'], [{ name: '' }]);

    const result = normalizeCSV(csv, { trimValues: true, lowercase: true });

    expect(result.rows[0].name).toBe('');
  });
});
