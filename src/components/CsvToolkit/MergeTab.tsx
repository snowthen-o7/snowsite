import React, { useState, useCallback } from 'react';
import { FileDropzone } from './FileDropzone';
import { DataPreview } from './DataPreview';
import { mergeCSV, suggestKeyColumns } from '../../lib/merge-engine';
import { downloadCSV } from '../../lib/csv-parser';
import type { ParsedCSV, MergeResult, MergeOptions } from '../../types/csv';

export function MergeTab() {
  const [csvA, setCsvA] = useState<ParsedCSV | null>(null);
  const [csvB, setCsvB] = useState<ParsedCSV | null>(null);
  const [result, setResult] = useState<MergeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Options
  const [keyColumn, setKeyColumn] = useState<string>('');
  const [strategy, setStrategy] = useState<MergeOptions['strategy']>('outer');
  const [conflictResolution, setConflictResolution] =
    useState<MergeOptions['conflictResolution']>('keepRight');

  const suggestedKeys = csvA ? suggestKeyColumns(csvA) : [];

  const handleFileA = useCallback((csv: ParsedCSV) => {
    setCsvA(csv);
    setResult(null);
    setError(null);
    const suggestions = suggestKeyColumns(csv);
    if (suggestions.length > 0) {
      setKeyColumn(suggestions[0]);
    }
  }, []);

  const handleFileB = useCallback((csv: ParsedCSV) => {
    setCsvB(csv);
    setResult(null);
    setError(null);
  }, []);

  const handleError = useCallback((err: string) => {
    setError(err);
  }, []);

  const runMerge = useCallback(() => {
    if (!csvA || !csvB || !keyColumn) return;

    try {
      const mergeResult = mergeCSV(csvA, csvB, {
        keyColumn,
        strategy,
        conflictResolution,
      });
      setResult(mergeResult);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Merge failed');
    }
  }, [csvA, csvB, keyColumn, strategy, conflictResolution]);

  const exportResult = useCallback(() => {
    if (!result) return;
    downloadCSV(result.merged, 'merged.csv');
  }, [result]);

  const reset = useCallback(() => {
    setCsvA(null);
    setCsvB(null);
    setResult(null);
    setError(null);
    setKeyColumn('');
  }, []);

  const commonColumns = csvA && csvB
    ? csvA.headers.filter((h) => csvB.headers.includes(h))
    : [];

  return (
    <div className="merge-tab">
      {/* File Upload */}
      {!result && (
        <div className="file-inputs">
          <div className="file-input-group">
            <label>Left File (A)</label>
            <FileDropzone
              onFileLoaded={handleFileA}
              onError={handleError}
              label="Drop left CSV"
            />
          </div>

          <div className="file-input-group">
            <label>Right File (B)</label>
            <FileDropzone
              onFileLoaded={handleFileB}
              onError={handleError}
              label="Drop right CSV"
            />
          </div>
        </div>
      )}

      {/* Options */}
      {csvA && csvB && !result && (
        <div className="options-panel">
          <h3>Merge Options</h3>

          <div className="options-grid">
            <div className="option-group">
              <label>Key Column</label>
              <select
                value={keyColumn}
                onChange={(e) => setKeyColumn(e.target.value)}
              >
                <option value="">Select key column...</option>
                {commonColumns.map((col) => (
                  <option key={col} value={col}>
                    {col} {suggestedKeys.includes(col) ? '(recommended)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="option-group">
              <label>Join Type</label>
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value as MergeOptions['strategy'])}
              >
                <option value="outer">Outer (all rows)</option>
                <option value="inner">Inner (matching only)</option>
                <option value="left">Left (all from A)</option>
                <option value="right">Right (all from B)</option>
              </select>
            </div>

            <div className="option-group">
              <label>On Conflict</label>
              <select
                value={conflictResolution}
                onChange={(e) =>
                  setConflictResolution(e.target.value as MergeOptions['conflictResolution'])
                }
              >
                <option value="keepRight">Keep right value</option>
                <option value="keepLeft">Keep left value</option>
                <option value="keepBoth">Keep both (A | B)</option>
              </select>
            </div>
          </div>

          <div className="action-buttons">
            <button
              className="btn-primary"
              onClick={runMerge}
              disabled={!keyColumn}
            >
              Merge Files
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

      {/* Results */}
      {result && (
        <div className="results-section">
          <div className="results-header">
            <div className="results-info">
              <h3>Merge Results</h3>
              <div className="results-stats">
                <span className="stat matched">{result.stats.matched} matched</span>
                <span className="stat-divider">•</span>
                <span className="stat left-only">{result.stats.leftOnly} left only</span>
                <span className="stat-divider">•</span>
                <span className="stat right-only">{result.stats.rightOnly} right only</span>
                {result.stats.conflicts > 0 && (
                  <>
                    <span className="stat-divider">•</span>
                    <span className="stat conflicts">{result.stats.conflicts} conflicts</span>
                  </>
                )}
              </div>
            </div>
            <div className="results-actions">
              <button className="btn-primary" onClick={exportResult}>
                Download CSV
              </button>
              <button className="btn-secondary" onClick={reset}>
                New Merge
              </button>
            </div>
          </div>

          <DataPreview data={result.merged} maxRows={50} />

          {result.conflicts.length > 0 && (
            <div className="conflicts-panel">
              <h4>{result.conflicts.length} Conflicts Resolved</h4>
              <div className="conflicts-list">
                {result.conflicts.slice(0, 10).map((c, i) => (
                  <div key={i} className="conflict-row">
                    <span className="conflict-key">{c.key}</span>
                    <span className="conflict-field">{c.field}:</span>
                    <span className="conflict-old">{c.leftValue}</span>
                    <span className="conflict-arrow">→</span>
                    <span className="conflict-new">{c.resolved}</span>
                  </div>
                ))}
                {result.conflicts.length > 10 && (
                  <div className="more-indicator">
                    ...and {result.conflicts.length - 10} more
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        .merge-tab {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .file-inputs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
        }

        @media (max-width: 640px) {
          .file-inputs {
            grid-template-columns: 1fr;
          }
        }

        .file-input-group {
          display: flex;
          flex-direction: column;
        }

        .file-input-group label {
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

        .options-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
          margin-bottom: 1rem;
        }

        @media (max-width: 768px) {
          .options-grid {
            grid-template-columns: 1fr;
          }
        }

        .option-group label {
          display: block;
          font-family: var(--font-mono);
          font-size: 0.75rem;
          color: var(--text-muted);
          margin-bottom: 0.25rem;
        }

        .option-group select {
          width: 100%;
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
          flex-wrap: wrap;
        }

        .stat {
          font-family: var(--font-mono);
        }

        .stat.matched { color: #4ade80; }
        .stat.left-only { color: #60a5fa; }
        .stat.right-only { color: #a78bfa; }
        .stat.conflicts { color: #fbbf24; }

        .stat-divider {
          color: var(--text-muted);
          opacity: 0.5;
        }

        .results-actions {
          display: flex;
          gap: 0.5rem;
        }

        .conflicts-panel {
          background: rgba(251, 191, 36, 0.1);
          border: 1px solid rgba(251, 191, 36, 0.3);
          border-radius: 8px;
          padding: 1rem;
          margin-top: 1rem;
        }

        .conflicts-panel h4 {
          font-size: 0.9rem;
          color: #fbbf24;
          margin: 0 0 0.75rem 0;
        }

        .conflicts-list {
          max-height: 200px;
          overflow-y: auto;
        }

        .conflict-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-family: var(--font-mono);
          font-size: 0.75rem;
          padding: 0.25rem 0;
          flex-wrap: wrap;
        }

        .conflict-key {
          color: var(--text);
          font-weight: 500;
        }

        .conflict-field {
          color: var(--text-muted);
        }

        .conflict-old {
          color: #f87171;
          text-decoration: line-through;
        }

        .conflict-arrow {
          color: var(--text-muted);
        }

        .conflict-new {
          color: #4ade80;
        }

        .more-indicator {
          font-size: 0.8rem;
          color: var(--text-muted);
          font-style: italic;
          padding-top: 0.5rem;
        }
      `}</style>
    </div>
  );
}

export default MergeTab;
