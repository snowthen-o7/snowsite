# CSV Toolkit

Browser-based CSV processing tools. All operations run entirely client-side - files never leave the user's device.

## Architecture

### Client-Side Processing

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  File Drop  │────▶│   Parser    │────▶│  ParsedCSV  │
│  (Browser)  │     │  (PapaParse)│     │   Object    │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                                               ▼
                    ┌─────────────────────────────────────┐
                    │         Processing Engine           │
                    │  ┌─────┐ ┌───────┐ ┌──────┐ ┌─────┐│
                    │  │Diff │ │ Merge │ │Dedupe│ │Trans││
                    │  └─────┘ └───────┘ └──────┘ └─────┘│
                    └─────────────────────────────────────┘
                                               │
                                               ▼
                    ┌─────────────────────────────────────┐
                    │          Results Display            │
                    │     (Tables, Stats, Export)         │
                    └─────────────────────────────────────┘
```

### Core Data Structure

```typescript
interface ParsedCSV {
  headers: string[];              // Column names
  rows: Record<string, string>[]; // Array of {column: value} objects
  rawData: string[][];            // Original 2D array
  filename: string;               // Source filename
  rowCount: number;               // Total rows (excluding header)
}
```

## Diff Tab

Compare two CSV files to find added, removed, and modified rows.

### Algorithm: EfficientDiffer

A memory-efficient, hash-based comparison algorithm (TypeScript port of `diaz_diff_checker` Python package).

#### Three-Phase Algorithm

**Phase 1: Build Production Index**
```
For each row in prod CSV:
  1. Generate composite key from primary key columns
  2. Hash all column values (fullHash)
  3. Hash only "meaningful" columns (compHash) - excludes inventory/availability
  4. Store: compositeKey → { lineNum, fullHash, compHash, displayKey }
```

**Phase 2: Detect Changes**
```
For each row in dev CSV:
  1. Generate composite key
  2. If key not in prod → ADDED
  3. If fullHash differs from prod:
     - If compHash differs → MEANINGFUL CHANGE
     - Else → EXCLUDED-ONLY CHANGE (inventory/availability)
```

**Phase 3: Collect Details**
```
For each changed row:
  1. Compare column-by-column
  2. Count changes per column
  3. Collect example rows with line numbers
```

#### Hash Function

Uses djb2 algorithm for fast string hashing:

```typescript
function hashString(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
```

#### Primary Key Detection

If not specified, auto-detects by:
1. Looking for common names: `id`, `sku`, `product_id`, `handle`, `barcode`, etc.
2. Finding columns with >95% unique values
3. Falling back to first column

#### Excluded Column Patterns

These columns are excluded from "meaningful" change detection (configurable in `lib/config.ts`):

- `inventory` (any column containing this word)
- `availability`

### Diff Result Structure

```typescript
interface DiffResult {
  rows_added: number;
  rows_removed: number;
  rows_updated: number;                    // Meaningful changes
  rows_updated_excluded_only: number;      // Only inventory/availability

  detailed_key_update_counts: Record<string, number>;  // Per-column counts

  example_ids: Record<string, { prod_line_num, dev_line_num }>;
  example_ids_added: Record<string, { dev_line_num }>;
  example_ids_removed: Record<string, { prod_line_num }>;

  common_keys: string[];     // Columns in both files
  prod_only_keys: string[];  // Columns only in prod
  dev_only_keys: string[];   // Columns only in dev

  prod_row_count: number;
  dev_row_count: number;
}
```

### Comparison Options

| Option | Default | Description |
|--------|---------|-------------|
| Primary Key | Auto-detect | Column(s) that uniquely identify rows |
| Case Sensitive | `true` | Whether comparisons are case-sensitive |
| Trim Whitespace | `true` | Remove leading/trailing whitespace |

### Composite Keys

Specify multiple columns separated by commas:

```
Primary Key: sku, locale
```

This creates a composite key like `ABC123||en-US` for matching rows.

## Merge Tab

Combine two CSV files by a key column.

### Join Strategies

| Strategy | Description |
|----------|-------------|
| **Left Join** | All rows from left file, matching from right |
| **Right Join** | All rows from right file, matching from left |
| **Inner Join** | Only rows with matches in both files |
| **Outer Join** | All rows from both files |

### Conflict Resolution

When the same column exists in both files with different values:

| Mode | Behavior |
|------|----------|
| Keep Left | Use value from left file |
| Keep Right | Use value from right file |
| Keep Both | Create `column_left` and `column_right` |

### Merge Result

```typescript
interface MergeResult {
  merged: ParsedCSV;
  conflicts: MergeConflict[];
  stats: {
    leftOnly: number;
    rightOnly: number;
    matched: number;
    conflicts: number;
  };
}
```

## Dedupe Tab

Remove duplicate rows from a CSV file.

### Options

| Option | Values | Description |
|--------|--------|-------------|
| Compare Columns | All / Select | Which columns to compare for duplicates |
| Keep Strategy | First / Last | Which occurrence to keep |
| Case Sensitive | true/false | Whether comparison is case-sensitive |

### Result

```typescript
interface DedupeResult {
  deduplicated: ParsedCSV;
  duplicatesRemoved: number;
  duplicateGroups: Array<{
    key: string;
    rows: Record<string, string>[];
    kept: Record<string, string>;
  }>;
}
```

## Transform Tab

Filter, sort, and reshape CSV data.

### Filter Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `equals` | Exact match | `status = active` |
| `contains` | Substring match | `name contains John` |
| `startsWith` | Prefix match | `sku starts with ABC` |
| `endsWith` | Suffix match | `email ends with .com` |
| `regex` | Regular expression | `phone matches ^\d{10}$` |
| `gt` / `gte` | Greater than | `price > 100` |
| `lt` / `lte` | Less than | `stock < 10` |
| `isEmpty` | No value | `description is empty` |
| `isNotEmpty` | Has value | `email is not empty` |

### Transform Options

```typescript
interface TransformOptions {
  filters: FilterRule[];
  selectedColumns: string[] | 'all';
  columnRenames: Record<string, string>;
  sortBy?: { column: string; direction: 'asc' | 'desc' };
}
```

## Component Structure

```
CsvToolkit/
├── index.tsx          # Tab navigation, main layout
├── FileDropzone.tsx   # Drag-and-drop CSV upload with PapaParse
├── DataPreview.tsx    # Table preview of parsed CSV
├── DiffTab.tsx        # Diff UI: file inputs, options, trigger
├── DiffView.tsx       # Diff results: stats, changes, examples
├── MergeTab.tsx       # Merge UI and logic
├── DedupeTab.tsx      # Dedupe UI and logic
└── TransformTab.tsx   # Transform UI and logic
```

## File Handling

### FileDropzone

Uses HTML5 drag-and-drop API with PapaParse for parsing:

```typescript
// Parse configuration
Papa.parse(file, {
  header: true,           // First row is headers
  skipEmptyLines: true,   // Ignore blank lines
  complete: (results) => {
    const parsed: ParsedCSV = {
      headers: results.meta.fields,
      rows: results.data,
      rawData: results.data.map(row =>
        results.meta.fields.map(h => row[h])
      ),
      filename: file.name,
      rowCount: results.data.length,
    };
    onFileLoaded(parsed);
  },
});
```

### Export

Results can be exported as JSON:

```typescript
const blob = new Blob([JSON.stringify(result, null, 2)], {
  type: 'application/json'
});
const url = URL.createObjectURL(blob);
// Trigger download...
```

## Performance Considerations

### Memory Efficiency

- Uses hash-based comparison (stores hashes, not full rows)
- Only loads rows needed for detailed comparison
- Limits example collection to configurable maximum

### Large Files

- No server round-trips (client-side processing)
- Browser memory is the limit
- Consider chunked processing for very large files (not implemented)

### UI Responsiveness

```typescript
// Use requestAnimationFrame to let UI update before heavy computation
await new Promise(resolve => requestAnimationFrame(resolve));
// Then run diff...
```

## Configuration

`src/lib/config.ts`:

```typescript
// Columns excluded from "meaningful" change detection
export const EXCLUDED_COLUMN_PATTERNS = [
  'inventory',
  'availability',
];

// Common primary key column names
export const COMMON_PRIMARY_KEY_NAMES = [
  'id', 'sku', 'product_id', 'handle', 'barcode',
  'upc', 'item_id', 'article_number', 'variant_id',
];

// Threshold for auto-detecting primary key uniqueness
export const PRIMARY_KEY_UNIQUENESS_THRESHOLD = 0.95;

// Maximum example rows to collect
export const DEFAULT_MAX_EXAMPLES = 10;
```

## Related Projects

The diff algorithm is a TypeScript port of [Diaz Diff Checker](https://github.com/snowthen-o7/data-diff-checker), a Python CLI tool for comparing large CSV/JSON files.
