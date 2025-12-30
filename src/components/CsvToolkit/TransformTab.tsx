import React, { useState, useCallback } from 'react';
import { FileDropzone } from './FileDropzone';
import { DataPreview } from './DataPreview';
import { transformCSV, previewFilter, createFilter, getColumnValues } from '../../lib/transform-engine';
import { downloadCSV } from '../../lib/csv-parser';
import type { ParsedCSV, TransformResult, FilterRule } from '../../types/csv';

type FilterOperator = FilterRule['operator'];

const OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: 'equals', label: 'equals' },
  { value: 'contains', label: 'contains' },
  { value: 'startsWith', label: 'starts with' },
  { value: 'endsWith', label: 'ends with' },
  { value: 'gt', label: '>' },
  { value: 'lt', label: '<' },
  { value: 'gte', label: '>=' },
  { value: 'lte', label: '<=' },
  { value: 'isEmpty', label: 'is empty' },
  { value: 'isNotEmpty', label: 'is not empty' },
  { value: 'regex', label: 'matches regex' },
];

export function TransformTab() {
  const [csv, setCsv] = useState<ParsedCSV | null>(null);
  const [result, setResult] = useState<TransformResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Options
  const [filters, setFilters] = useState<FilterRule[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [columnRenames, setColumnRenames] = useState<Record<string, string>>({});
  const [sortColumn, setSortColumn] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleFile = useCallback((parsed: ParsedCSV) => {
    setCsv(parsed);
    setResult(null);
    setError(null);
    setFilters([]);
    setSelectedColumns(parsed.headers);
    setColumnRenames({});
    setSortColumn('');
  }, []);

  const handleError = useCallback((err: string) => {
    setError(err);
  }, []);

  // Filter management
  const addFilter = () => {
    if (!csv) return;
    setFilters([...filters, createFilter(csv.headers[0], 'contains', '', false)]);
  };

  const updateFilter = (index: number, updates: Partial<FilterRule>) => {
    setFilters(filters.map((f, i) => (i === index ? { ...f, ...updates } : f)));
  };

  const removeFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  // Column selection
  const toggleColumn = (col: string) => {
    setSelectedColumns((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
  };

  const selectAllColumns = () => {
    if (csv) setSelectedColumns(csv.headers);
  };

  const clearColumns = () => {
    setSelectedColumns([]);
  };

  const updateRename = (original: string, newName: string) => {
    if (newName === '' || newName === original) {
      const updated = { ...columnRenames };
      delete updated[original];
      setColumnRenames(updated);
    } else {
      setColumnRenames({ ...columnRenames, [original]: newName });
    }
  };

  const runTransform = useCallback(() => {
    if (!csv) return;

    try {
      const transformResult = transformCSV(csv, {
        filters,
        selectedColumns: selectedColumns.length === csv.headers.length ? 'all' : selectedColumns,
        columnRenames,
        sortBy: sortColumn ? { column: sortColumn, direction: sortDirection } : undefined,
      });
      setResult(transformResult);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transform failed');
    }
  }, [csv, filters, selectedColumns, columnRenames, sortColumn, sortDirection]);

  const exportResult = useCallback(() => {
    if (!result) return;
    downloadCSV(result.transformed);
  }, [result]);

  const reset = useCallback(() => {
    setCsv(null);
    setResult(null);
    setError(null);
    setFilters([]);
    setSelectedColumns([]);
    setColumnRenames({});
    setSortColumn('');
  }, []);

  // Preview
  const filterPreview = csv && filters.length > 0 ? previewFilter(csv, filters) : null;

  return (
    <div className="transform-tab">
      {/* File Upload */}
      {!result && (
        <div className="file-input-container">
          <label>Upload CSV</label>
          <FileDropzone
            onFileLoaded={handleFile}
            onError={handleError}
          />
        </div>
      )}

      {/* Options */}
      {csv && !result && (
        <div className="options-container">
          {/* Filters */}
          <div className="options-panel">
            <div className="panel-header">
              <h3>Filters</h3>
              <button className="add-filter-btn" onClick={addFilter}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add Filter
              </button>
            </div>

            {filters.length === 0 ? (
              <p className="empty-message">No filters applied. All rows will be included.</p>
            ) : (
              <div className="filters-list">
                {filters.map((filter, idx) => (
                  <div key={idx} className="filter-row">
                    <select
                      value={filter.column}
                      onChange={(e) => updateFilter(idx, { column: e.target.value })}
                    >
                      {csv.headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>

                    <label className="negate-label">
                      <input
                        type="checkbox"
                        checked={filter.negate}
                        onChange={(e) => updateFilter(idx, { negate: e.target.checked })}
                      />
                      <span>NOT</span>
                    </label>

                    <select
                      value={filter.operator}
                      onChange={(e) => updateFilter(idx, { operator: e.target.value as FilterOperator })}
                    >
                      {OPERATORS.map((op) => (
                        <option key={op.value} value={op.value}>{op.label}</option>
                      ))}
                    </select>

                    {!['isEmpty', 'isNotEmpty'].includes(filter.operator) && (
                      <input
                        type="text"
                        value={filter.value}
                        onChange={(e) => updateFilter(idx, { value: e.target.value })}
                        placeholder="value"
                        className="filter-value"
                      />
                    )}

                    <button
                      className="remove-filter-btn"
                      onClick={() => removeFilter(idx)}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {filterPreview && (
              <div className="filter-preview">
                <span className="preview-count">{filterPreview.matchCount.toLocaleString()}</span>
                <span className="preview-label">of {csv.rowCount.toLocaleString()} rows match</span>
              </div>
            )}
          </div>

          {/* Column Selection */}
          <div className="options-panel">
            <div className="panel-header">
              <h3>Select & Rename Columns</h3>
              <div className="column-actions">
                <button onClick={selectAllColumns}>Select all</button>
                <button onClick={clearColumns}>Clear</button>
              </div>
            </div>
            <div className="columns-list">
              {csv.headers.map((col) => (
                <div key={col} className="column-row">
                  <label className="column-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedColumns.includes(col)}
                      onChange={() => toggleColumn(col)}
                    />
                    <span>{col}</span>
                  </label>
                  {selectedColumns.includes(col) && (
                    <input
                      type="text"
                      placeholder="rename to..."
                      value={columnRenames[col] || ''}
                      onChange={(e) => updateRename(col, e.target.value)}
                      className="rename-input"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Sort */}
          <div className="options-panel">
            <h3>Sort</h3>
            <div className="sort-controls">
              <div className="option-group">
                <label>Sort by column</label>
                <select
                  value={sortColumn}
                  onChange={(e) => setSortColumn(e.target.value)}
                >
                  <option value="">No sorting</option>
                  {csv.headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
              {sortColumn && (
                <div className="option-group">
                  <label>Direction</label>
                  <select
                    value={sortDirection}
                    onChange={(e) => setSortDirection(e.target.value as 'asc' | 'desc')}
                  >
                    <option value="asc">Ascending</option>
                    <option value="desc">Descending</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="action-buttons">
            <button
              className="btn-primary"
              onClick={runTransform}
              disabled={selectedColumns.length === 0}
            >
              Apply Transform
            </button>
            <button className="btn-secondary" onClick={reset}>
              Reset
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="error-banner">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          <span>
            {error.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
              part.match(/^https?:\/\//) ? (
                <a key={i} href={part} target="_blank" rel="noopener noreferrer">{part}</a>
              ) : part
            )}
          </span>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="results-section">
          <div className="results-header">
            <div className="results-info">
              <h3>Transform Results</h3>
              <div className="results-stats">
                <span className="stat filtered">
                  {result.filteredRowCount.toLocaleString()} of {result.originalRowCount.toLocaleString()} rows
                </span>
                <span className="stat-divider">•</span>
                <span className="stat columns">{result.columnsSelected} columns</span>
              </div>
            </div>
            <div className="results-actions">
              <button className="btn-primary" onClick={exportResult}>
                Download CSV
              </button>
              <button className="btn-secondary" onClick={reset}>
                Start Over
              </button>
            </div>
          </div>

          <DataPreview data={result.transformed} maxRows={50} />
        </div>
      )}

      <style>{`
        .transform-tab {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .file-input-container {
          margin-bottom: 0.5rem;
        }

        .file-input-container > label {
          display: block;
          font-family: var(--font-mono);
          font-size: 0.8rem;
          color: var(--text-muted);
          margin-bottom: 0.5rem;
        }

        .options-container {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .options-panel {
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 1.25rem;
        }

        .options-panel h3 {
          font-size: 0.9rem;
          margin: 0;
          color: var(--text);
        }

        .panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1rem;
        }

        .add-filter-btn {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          background: none;
          border: none;
          font-family: var(--font-mono);
          font-size: 0.75rem;
          color: var(--accent);
          cursor: pointer;
          padding: 0;
        }

        .add-filter-btn:hover {
          text-decoration: underline;
        }

        .add-filter-btn svg {
          width: 0.875rem;
          height: 0.875rem;
        }

        .empty-message {
          font-size: 0.85rem;
          color: var(--text-muted);
          margin: 0;
        }

        .filters-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .filter-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .filter-row select {
          padding: 0.4rem 0.6rem;
          font-family: var(--font-mono);
          font-size: 0.8rem;
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          border-radius: 4px;
          color: var(--text);
        }

        .filter-row select:focus {
          outline: none;
          border-color: var(--accent);
        }

        .negate-label {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          font-family: var(--font-mono);
          font-size: 0.75rem;
          color: var(--text-muted);
          cursor: pointer;
        }

        .negate-label input {
          accent-color: var(--accent);
        }

        .filter-value {
          flex: 1;
          min-width: 100px;
          padding: 0.4rem 0.6rem;
          font-family: var(--font-mono);
          font-size: 0.8rem;
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          border-radius: 4px;
          color: var(--text);
        }

        .filter-value:focus {
          outline: none;
          border-color: var(--accent);
        }

        .filter-value::placeholder {
          color: var(--text-muted);
          opacity: 0.6;
        }

        .remove-filter-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 1.5rem;
          height: 1.5rem;
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 0;
          border-radius: 4px;
          transition: all 0.15s ease;
        }

        .remove-filter-btn:hover {
          color: #f87171;
          background: rgba(248, 113, 113, 0.1);
        }

        .remove-filter-btn svg {
          width: 1rem;
          height: 1rem;
        }

        .filter-preview {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid var(--border);
        }

        .preview-count {
          font-family: var(--font-mono);
          font-size: 1rem;
          font-weight: 600;
          color: #4ade80;
        }

        .preview-label {
          font-size: 0.85rem;
          color: var(--text-muted);
        }

        .column-actions {
          display: flex;
          gap: 0.75rem;
        }

        .column-actions button {
          background: none;
          border: none;
          font-family: var(--font-mono);
          font-size: 0.75rem;
          color: var(--accent);
          cursor: pointer;
        }

        .column-actions button:hover {
          text-decoration: underline;
        }

        .columns-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          max-height: 300px;
          overflow-y: auto;
        }

        .column-row {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .column-checkbox {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
          min-width: 150px;
        }

        .column-checkbox input {
          accent-color: var(--accent);
        }

        .column-checkbox span {
          font-size: 0.85rem;
          color: var(--text);
        }

        .rename-input {
          flex: 1;
          max-width: 200px;
          padding: 0.35rem 0.5rem;
          font-family: var(--font-mono);
          font-size: 0.8rem;
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          border-radius: 4px;
          color: var(--text);
        }

        .rename-input:focus {
          outline: none;
          border-color: var(--accent);
        }

        .rename-input::placeholder {
          color: var(--text-muted);
          opacity: 0.6;
        }

        .sort-controls {
          display: flex;
          gap: 1rem;
          margin-top: 0.75rem;
        }

        .option-group label {
          display: block;
          font-family: var(--font-mono);
          font-size: 0.75rem;
          color: var(--text-muted);
          margin-bottom: 0.25rem;
        }

        .option-group select {
          padding: 0.5rem;
          font-family: var(--font-mono);
          font-size: 0.8rem;
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          border-radius: 4px;
          color: var(--text);
        }

        .option-group select:focus {
          outline: none;
          border-color: var(--accent);
        }

        .action-buttons {
          display: flex;
          gap: 0.5rem;
        }

        .btn-primary, .btn-secondary {
          font-family: var(--font-mono);
          font-size: 0.85rem;
          padding: 0.5rem 1rem;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-primary {
          background: var(--accent);
          color: var(--bg);
          border: none;
        }

        .btn-primary:hover:not(:disabled) {
          background: var(--text);
        }

        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: transparent;
          color: var(--text-muted);
          border: 1px solid var(--border);
        }

        .btn-secondary:hover {
          color: var(--text);
          border-color: var(--text-muted);
        }

        .error-banner {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          background: rgba(248, 113, 113, 0.1);
          border: 1px solid rgba(248, 113, 113, 0.3);
          border-radius: 6px;
          color: #f87171;
          font-size: 0.875rem;
        }

        .error-banner svg {
          width: 1.25rem;
          height: 1.25rem;
          flex-shrink: 0;
        }

        .error-banner span {
          flex: 1;
        }

        .error-banner button {
          background: transparent;
          border: none;
          color: inherit;
          font-size: 1.25rem;
          cursor: pointer;
          padding: 0;
        }

        .error-banner a {
          color: inherit;
          text-decoration: underline;
          word-break: break-all;
        }

        .error-banner a:hover {
          opacity: 0.8;
        }

        .results-section {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .results-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .results-info h3 {
          font-size: 1.1rem;
          margin: 0 0 0.25rem 0;
        }

        .results-stats {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.8rem;
        }

        .stat {
          font-family: var(--font-mono);
        }

        .stat.filtered { color: #4ade80; }
        .stat.columns { color: #60a5fa; }

        .stat-divider {
          color: var(--text-muted);
          opacity: 0.5;
        }

        .results-actions {
          display: flex;
          gap: 0.5rem;
        }

        @media (max-width: 640px) {
          .filter-row {
            flex-direction: column;
            align-items: stretch;
          }

          .filter-row select,
          .filter-value {
            width: 100%;
          }

          .filter-row .negate-label {
            order: -1;
          }

          .remove-filter-btn {
            align-self: flex-end;
          }

          .column-row {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.5rem;
          }

          .rename-input {
            max-width: none;
            width: 100%;
          }

          .sort-controls {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}

export default TransformTab;
