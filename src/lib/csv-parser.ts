import Papa from 'papaparse';
import type { ParsedCSV } from '../types/csv';
import { DEFAULT_PARSE_CONFIG, type ParseConfig } from './config';

/**
 * Information about detected CSV format.
 * Mirrors Python's StreamingCSVReader detection capabilities.
 */
export interface CSVFormatInfo {
  /** Detected delimiter character */
  delimiter: string;
  /** Detected line ending */
  linebreak: string;
  /** Whether the file appears to use quotes */
  quoteChar: string;
  /** Number of columns detected */
  columnCount: number;
  /** Whether headers were detected */
  hasHeaders: boolean;
}

/**
 * Parse a CSV file and return structured data.
 * 
 * Uses Papa Parse which handles:
 * - Auto-detection of delimiters (comma, tab, semicolon, pipe)
 * - UTF-8 BOM markers
 * - Quoted fields with embedded delimiters/newlines
 * - Both "" and \" escape styles
 */
export function parseCSVFile(
  file: File,
  options: Partial<ParseConfig> = {}
): Promise<ParsedCSV> {
  const opts = { ...DEFAULT_PARSE_CONFIG, ...options };

  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: opts.header,
      skipEmptyLines: opts.skipEmptyLines,
      dynamicTyping: opts.dynamicTyping,
      delimiter: opts.delimiter || '', // Empty string = auto-detect
      transformHeader: opts.trimHeaders ? (h) => h.trim() : undefined,
      complete: (results) => {
        if (results.errors.length > 0) {
          const criticalErrors = results.errors.filter(
            (e) => e.type === 'Quotes' || e.type === 'FieldMismatch'
          );
          if (criticalErrors.length > 0) {
            reject(new Error(`Parse error: ${criticalErrors[0].message}`));
            return;
          }
        }

        const headers = results.meta.fields || [];
        const rows = results.data as Record<string, string>[];

        resolve({
          headers,
          rows,
          filename: file.name,
          rowCount: rows.length,
        });
      },
      error: (error) => {
        reject(new Error(`Failed to parse CSV: ${error.message}`));
      },
    });
  });
}

/**
 * Parse CSV from string content.
 */
export function parseCSVString(
  content: string,
  filename: string = 'data.csv',
  options: Partial<ParseConfig> = {}
): ParsedCSV {
  const opts = { ...DEFAULT_PARSE_CONFIG, ...options };

  const results = Papa.parse(content, {
    header: opts.header,
    skipEmptyLines: opts.skipEmptyLines,
    dynamicTyping: opts.dynamicTyping,
    delimiter: opts.delimiter || '',
    transformHeader: opts.trimHeaders ? (h) => h.trim() : undefined,
  });

  if (results.errors.length > 0) {
    const criticalErrors = results.errors.filter(
      (e) => e.type === 'Quotes' || e.type === 'FieldMismatch'
    );
    if (criticalErrors.length > 0) {
      throw new Error(`Parse error: ${criticalErrors[0].message}`);
    }
  }

  const headers = results.meta.fields || [];
  const rows = results.data as Record<string, string>[];

  return {
    headers,
    rows,
    filename,
    rowCount: rows.length,
  };
}

/**
 * Detect CSV format without fully parsing.
 * Useful for previewing files or validating format.
 */
export function detectCSVFormat(content: string): CSVFormatInfo {
  // Use Papa's delimiter detection on first few lines
  const preview = content.slice(0, 10000);
  const result = Papa.parse(preview, {
    preview: 5, // Only parse first 5 rows
    header: true,
  });

  return {
    delimiter: result.meta.delimiter || ',',
    linebreak: result.meta.linebreak || '\n',
    quoteChar: '"', // Papa Parse always uses "
    columnCount: result.meta.fields?.length || 0,
    hasHeaders: true, // Assumed since we parsed with header: true
  };
}

/**
 * Convert ParsedCSV back to CSV string.
 */
export function toCSVString(data: ParsedCSV, delimiter: string = ','): string {
  return Papa.unparse({
    fields: data.headers,
    data: data.rows,
  }, {
    delimiter,
  });
}

/**
 * Download CSV data as a file.
 */
export function downloadCSV(data: ParsedCSV, filename?: string): void {
  const csvString = toCSVString(data);
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename || data.filename || 'export.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Get column statistics for preview.
 */
export function getColumnStats(
  data: ParsedCSV,
  column: string
): {
  uniqueValues: number;
  emptyCount: number;
  sampleValues: string[];
  inferredType: 'number' | 'date' | 'boolean' | 'string';
} {
  const values = data.rows.map((row) => row[column] || '');
  const uniqueSet = new Set(values);
  const emptyCount = values.filter((v) => v === '').length;
  const nonEmpty = values.filter((v) => v !== '');
  const sampleValues = [...new Set(nonEmpty)].slice(0, 5);

  // Infer type
  let inferredType: 'number' | 'date' | 'boolean' | 'string' = 'string';
  
  if (nonEmpty.length > 0) {
    // Check for numbers
    const allNumbers = nonEmpty.every((s) => !isNaN(parseFloat(s)) && isFinite(Number(s)));
    if (allNumbers) {
      inferredType = 'number';
    } else {
      // Check for booleans
      const boolValues = new Set(['true', 'false', 'yes', 'no', '1', '0', 'y', 'n']);
      const allBool = nonEmpty.every((s) => boolValues.has(s.toLowerCase()));
      if (allBool) {
        inferredType = 'boolean';
      } else {
        // Check for dates
        const datePattern = /^\d{4}-\d{2}-\d{2}|^\d{1,2}\/\d{1,2}\/\d{2,4}/;
        const likelyDates = nonEmpty.filter((s) => datePattern.test(s)).length;
        if (likelyDates / nonEmpty.length > 0.8) {
          inferredType = 'date';
        }
      }
    }
  }

  return {
    uniqueValues: uniqueSet.size,
    emptyCount,
    sampleValues,
    inferredType,
  };
}

/**
 * Suggest columns that could be used as primary keys.
 * A good primary key has high uniqueness (>95% unique values).
 */
export function suggestPrimaryKeys(csv: ParsedCSV): string[] {
  const suggestions: { column: string; uniqueness: number }[] = [];

  for (const header of csv.headers) {
    const values = csv.rows.map((r) => r[header] || '');
    const nonEmpty = values.filter(v => v !== '');
    if (nonEmpty.length === 0) continue;
    
    const uniqueCount = new Set(nonEmpty).size;
    const uniqueness = uniqueCount / nonEmpty.length;

    if (uniqueness > 0.95) {
      suggestions.push({ column: header, uniqueness });
    }
  }

  // Sort by uniqueness descending, then by common name patterns
  const commonNames = ['id', 'sku', 'uuid', 'key', 'product_id', 'item_id'];
  
  return suggestions
    .sort((a, b) => {
      // Prioritize common ID column names
      const aIsCommon = commonNames.some(n => a.column.toLowerCase().includes(n));
      const bIsCommon = commonNames.some(n => b.column.toLowerCase().includes(n));
      if (aIsCommon && !bIsCommon) return -1;
      if (!aIsCommon && bIsCommon) return 1;
      // Then by uniqueness
      return b.uniqueness - a.uniqueness;
    })
    .map((s) => s.column);
}

/**
 * Validate that a CSV has required columns.
 */
export function validateRequiredColumns(
  csv: ParsedCSV,
  requiredColumns: string[]
): { valid: boolean; missing: string[] } {
  const headerSet = new Set(csv.headers.map(h => h.toLowerCase()));
  const missing = requiredColumns.filter(
    col => !headerSet.has(col.toLowerCase())
  );
  
  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Normalize a CSV for comparison.
 * - Trims all values
 * - Optionally lowercases
 * - Sorts rows by specified key
 */
export function normalizeCSV(
  csv: ParsedCSV,
  options: {
    trimValues?: boolean;
    lowercase?: boolean;
    sortByColumn?: string;
  } = {}
): ParsedCSV {
  const { trimValues = true, lowercase = false, sortByColumn } = options;

  let rows = csv.rows.map(row => {
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      let val = value || '';
      if (trimValues) val = val.trim();
      if (lowercase) val = val.toLowerCase();
      normalized[key] = val;
    }
    return normalized;
  });

  if (sortByColumn && csv.headers.includes(sortByColumn)) {
    rows = [...rows].sort((a, b) => {
      const valA = a[sortByColumn] || '';
      const valB = b[sortByColumn] || '';
      return valA.localeCompare(valB);
    });
  }

  return {
    ...csv,
    rows,
  };
}
