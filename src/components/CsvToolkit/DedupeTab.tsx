import React, { useState, useCallback } from 'react';
import { FileDropzone } from './FileDropzone';
import { DataPreview } from './DataPreview';
import { dedupeCSV, getDuplicateStats, findDuplicates } from '../../lib/dedupe-engine';
import { downloadCSV } from '../../lib/csv-parser';
import type { ParsedCSV, DedupeResult, DedupeOptions, DuplicateGroup } from '../../types/csv';

export function DedupeTab() {
  const [csv, setCsv] = useState<ParsedCSV | null>(null);
  const [result, setResult] = useState<DedupeResult | null>(null);
  const [preview, setPreview] = useState<DuplicateGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Options
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [keepStrategy, setKeepStrategy] = useState<DedupeOptions['keepStrategy']>('first');
  const [caseSensitive, setCaseSensitive] = useState(true);

  const handleFile = useCallback((parsed: ParsedCSV) => {
    setCsv(parsed);
    setResult(null);
    setPreview(null);
    setError(null);
    setSelectedColumns(parsed.headers);
  }, []);

  const handleError = useCallback((err: string) => {
    setError(err);
  }, []);

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

  const previewDuplicates = useCallback(() => {
    if (!csv || selectedColumns.length === 0) return;

    try {
      const duplicates = findDuplicates(csv, {
        compareColumns: selectedColumns,
        keepStrategy,
        caseSensitive,
      });
      setPreview(duplicates);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed');
    }
  }, [csv, selectedColumns, keepStrategy, caseSensitive]);

  const runDedupe = useCallback(() => {
    if (!csv || selectedColumns.length === 0) return;

    try {
      const dedupeResult = dedupeCSV(csv, {
        compareColumns: selectedColumns,
        keepStrategy,
        caseSensitive,
      });
      setResult(dedupeResult);
      setPreview(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dedupe failed');
    }
  }, [csv, selectedColumns, keepStrategy, caseSensitive]);

  const exportResult = useCallback(() => {
    if (!result) return;
    downloadCSV(result.deduplicated);
  }, [result]);

  const reset = useCallback(() => {
    setCsv(null);
    setResult(null);
    setPreview(null);
    setError(null);
    setSelectedColumns([]);
  }, []);

  const stats = csv && selectedColumns.length > 0
    ? getDuplicateStats(csv, { compareColumns: selectedColumns, caseSensitive })
    : null;

  return (
    <div className="dedupe-tab">
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
        <div className="options-panel">
          <h3>Dedupe Options</h3>

          {/* Column Selection */}
          <div className="column-section">
            <div className="column-header">
              <label>Columns to compare for duplicates</label>
              <div className="column-actions">
                <button onClick={selectAllColumns}>Select all</button>
                <button onClick={clearColumns}>Clear</button>
              </div>
            </div>
            <div className="column-chips">
              {csv.headers.map((col) => (
                <button
                  key={col}
                  onClick={() => toggleColumn(col)}
                  className={`column-chip ${selectedColumns.includes(col) ? 'selected' : ''}`}
                >
                  {col}
                </button>
              ))}
            </div>
          </div>

          {/* Other options */}
          <div className="options-row">
            <div className="option-group">
              <label>Keep which duplicate?</label>
              <select
                value={keepStrategy}
                onChange={(e) => setKeepStrategy(e.target.value as DedupeOptions['keepStrategy'])}
              >
                <option value="first">First occurrence</option>
                <option value="last">Last occurrence</option>
              </select>
            </div>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={caseSensitive}
                onChange={(e) => setCaseSensitive(e.target.checked)}
              />
              <span>Case sensitive</span>
            </label>
          </div>

          {/* Stats Preview */}
          {stats && (
            <div className="stats-grid">
              <div className="stat-box">
                <span className="stat-value">{stats.totalRows.toLocaleString()}</span>
                <span className="stat-label">Total Rows</span>
              </div>
              <div className="stat-box unique">
                <span className="stat-value">{stats.uniqueRows.toLocaleString()}</span>
                <span className="stat-label">Unique</span>
              </div>
              <div className="stat-box duplicates">
                <span className="stat-value">{stats.duplicateRows.toLocaleString()}</span>
                <span className="stat-label">Duplicates</span>
              </div>
              <div className="stat-box groups">
                <span className="stat-value">{stats.duplicateGroups.toLocaleString()}</span>
                <span className="stat-label">Groups</span>
              </div>
            </div>
          )}

          <div className="action-buttons">
            <button
              className="btn-secondary"
              onClick={previewDuplicates}
              disabled={selectedColumns.length === 0}
            >
              Preview Duplicates
            </button>
            <button
              className="btn-primary"
              onClick={runDedupe}
              disabled={selectedColumns.length === 0}
            >
              Remove Duplicates
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

      {/* Preview */}
      {preview && preview.length > 0 && (
        <div className="preview-panel">
          <h4>Found {preview.length} Duplicate Groups</h4>
          <div className="preview-list">
            {preview.slice(0, 5).map((group, i) => (
              <div key={i} className="preview-group">
                <span className="group-count">{group.rows.length} duplicate rows</span>
                <span className="group-sample">
                  {Object.entries(group.kept)
                    .slice(0, 3)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(' • ')}
                </span>
              </div>
            ))}
            {preview.length > 5 && (
              <div className="more-indicator">...and {preview.length - 5} more groups</div>
            )}
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="results-section">
          <div className="results-header">
            <div className="results-info">
              <h3>Deduplicated Results</h3>
              <p className="results-summary">
                Removed <span className="removed-count">{result.duplicatesRemoved}</span> duplicate rows
              </p>
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

          <DataPreview data={result.deduplicated} maxRows={50} />
        </div>
      )}

      <style>{`
        .dedupe-tab {
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

        .options-panel {
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 1.25rem;
        }

        .options-panel h3 {
          font-size: 0.9rem;
          margin: 0 0 1rem 0;
          color: var(--text);
        }

        .column-section {
          margin-bottom: 1rem;
        }

        .column-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.5rem;
        }

        .column-header label {
          font-family: var(--font-mono);
          font-size: 0.75rem;
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

        .column-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .column-chip {
          font-family: var(--font-mono);
          font-size: 0.75rem;
          padding: 0.35rem 0.75rem;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: var(--bg-elevated);
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .column-chip:hover {
          border-color: var(--text-muted);
        }

        .column-chip.selected {
          background: var(--accent);
          color: var(--bg);
          border-color: var(--accent);
        }

        .options-row {
          display: flex;
          align-items: center;
          gap: 1.5rem;
          margin-bottom: 1rem;
          flex-wrap: wrap;
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

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
          font-size: 0.85rem;
          color: var(--text-muted);
        }

        .checkbox-label input {
          accent-color: var(--accent);
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0.75rem;
          margin-bottom: 1rem;
        }

        @media (max-width: 640px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        .stat-box {
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 0.75rem;
          text-align: center;
        }

        .stat-value {
          display: block;
          font-family: var(--font-mono);
          font-size: 1.25rem;
          font-weight: 600;
          color: var(--text);
        }

        .stat-box.unique .stat-value { color: #4ade80; }
        .stat-box.duplicates .stat-value { color: #f87171; }
        .stat-box.groups .stat-value { color: #fbbf24; }

        .stat-label {
          font-size: 0.7rem;
          color: var(--text-muted);
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

        .btn-secondary:hover:not(:disabled) {
          color: var(--text);
          border-color: var(--text-muted);
        }

        .btn-secondary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
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

        .preview-panel {
          background: rgba(251, 191, 36, 0.1);
          border: 1px solid rgba(251, 191, 36, 0.3);
          border-radius: 8px;
          padding: 1rem;
        }

        .preview-panel h4 {
          font-size: 0.9rem;
          color: #fbbf24;
          margin: 0 0 0.75rem 0;
        }

        .preview-list {
          max-height: 200px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .preview-group {
          background: var(--bg);
          border: 1px solid rgba(251, 191, 36, 0.3);
          border-radius: 6px;
          padding: 0.75rem;
        }

        .group-count {
          display: block;
          font-family: var(--font-mono);
          font-size: 0.7rem;
          color: #fbbf24;
          margin-bottom: 0.25rem;
        }

        .group-sample {
          font-size: 0.8rem;
          color: var(--text);
        }

        .more-indicator {
          font-size: 0.8rem;
          color: var(--text-muted);
          font-style: italic;
          padding-top: 0.25rem;
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

        .results-summary {
          font-size: 0.85rem;
          color: var(--text-muted);
          margin: 0;
        }

        .removed-count {
          color: #4ade80;
          font-family: var(--font-mono);
          font-weight: 500;
        }

        .results-actions {
          display: flex;
          gap: 0.5rem;
        }
      `}</style>
    </div>
  );
}

export default DedupeTab;
