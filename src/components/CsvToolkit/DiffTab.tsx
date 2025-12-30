import React, { useState, useCallback, useMemo } from 'react';
import { FileDropzone } from './FileDropzone';
import { DiffView } from './DiffView';
import { diffCSV } from '../../lib/diff-engine';
import { EXCLUDED_COLUMN_PATTERNS } from '../../lib/config';
import type { ParsedCSV, DiffResult } from '../../types/csv';

export function DiffTab() {
  const [csvA, setCsvA] = useState<ParsedCSV | null>(null);
  const [csvB, setCsvB] = useState<ParsedCSV | null>(null);
  const [result, setResult] = useState<DiffResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isComparing, setIsComparing] = useState(false);

  // Options
  const [primaryKey, setPrimaryKey] = useState<string>('');
  const [caseSensitive, setCaseSensitive] = useState(true);
  const [trimWhitespace, setTrimWhitespace] = useState(true);

  const handleFileA = useCallback((csv: ParsedCSV) => {
    setCsvA(csv);
    setResult(null);
    setError(null);
  }, []);

  const handleFileB = useCallback((csv: ParsedCSV) => {
    setCsvB(csv);
    setResult(null);
    setError(null);
  }, []);

  const handleError = useCallback((err: string) => {
    setError(err);
  }, []);

  // Common columns between both files for key selection
  const commonColumns = useMemo(() => {
    if (!csvA || !csvB) return [];
    return csvA.headers.filter(h => csvB.headers.includes(h));
  }, [csvA, csvB]);

  const runDiff = useCallback(async () => {
    if (!csvA || !csvB) return;

    setIsComparing(true);
    setError(null);

    // Use requestAnimationFrame to let UI update before heavy computation
    await new Promise(resolve => requestAnimationFrame(resolve));

    try {
      const primaryKeys = primaryKey
        ? primaryKey.split(',').map(k => k.trim()).filter(Boolean)
        : undefined;

      const diffResult = diffCSV(csvA, csvB, {
        primaryKeys,
        caseSensitive,
        trimWhitespace,
        excludedPatterns: EXCLUDED_COLUMN_PATTERNS,
        maxExamples: 10,
      });

      setResult(diffResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Comparison failed');
    } finally {
      setIsComparing(false);
    }
  }, [csvA, csvB, primaryKey, caseSensitive, trimWhitespace]);

  const exportResults = useCallback(() => {
    if (!result) return;

    const jsonStr = JSON.stringify(result, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'diff-results.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [result]);

  const reset = useCallback(() => {
    setCsvA(null);
    setCsvB(null);
    setResult(null);
    setError(null);
    setPrimaryKey('');
  }, []);

  const canCompare = csvA && csvB && !isComparing;

  return (
    <div className="diff-tab">
      {/* Step indicator */}
      <div className="steps">
        <div className={`step ${csvA ? 'complete' : 'active'}`}>
          <span className="step-num">1</span>
          <span className="step-label">Original</span>
        </div>
        <div className="step-line" />
        <div className={`step ${csvB ? 'complete' : csvA ? 'active' : ''}`}>
          <span className="step-num">2</span>
          <span className="step-label">Comparison</span>
        </div>
        <div className="step-line" />
        <div className={`step ${result ? 'complete' : canCompare ? 'active' : ''}`}>
          <span className="step-num">3</span>
          <span className="step-label">Results</span>
        </div>
      </div>

      {/* File inputs - side by side */}
      {!result && (
        <div className="file-inputs">
          <div className="file-input-group">
            <label>Original File (Prod)</label>
            <FileDropzone
              onFileLoaded={handleFileA}
              onError={handleError}
              label="Drop original CSV"
            />
          </div>

          <div className="file-input-group">
            <label>Comparison File (Dev)</label>
            <FileDropzone
              onFileLoaded={handleFileB}
              onError={handleError}
              label="Drop comparison CSV"
            />
          </div>
        </div>
      )}

      {/* Options panel - only show when both files loaded but no result yet */}
      {csvA && csvB && !result && (
        <div className="options-panel">
          <h3>Comparison Options</h3>

          <div className="options-grid">
            <div className="option-group">
              <label htmlFor="primary-key" className="label-with-tooltip">
                Primary Key
                <span className="tooltip-wrapper">
                  <svg className="info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4M12 8h.01" />
                  </svg>
                  <span className="tooltip-content">
                    <strong>Auto-detect</strong> finds the primary key by:
                    <br />1. Checking common names: <code>id</code>, <code>sku</code>, <code>uuid</code>, <code>product_id</code>, etc.
                    <br />2. Finding columns with &gt;95% unique values
                    <br />3. Falling back to the first column
                    <br /><br />For composite keys, type multiple columns separated by commas.
                  </span>
                </span>
              </label>
              <select
                id="primary-key"
                value={primaryKey}
                onChange={(e) => setPrimaryKey(e.target.value)}
              >
                <option value="">Auto-detect</option>
                {commonColumns.map((col) => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
              <span className="option-hint">
                For composite keys, type below: <code>sku, locale</code>
              </span>
              <input
                type="text"
                value={primaryKey}
                onChange={(e) => setPrimaryKey(e.target.value)}
                placeholder="e.g., sku, locale"
              />
            </div>

            <div className="option-group checkboxes">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={caseSensitive}
                  onChange={(e) => setCaseSensitive(e.target.checked)}
                />
                <span> Case sensitive</span>
              </label>

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={trimWhitespace}
                  onChange={(e) => setTrimWhitespace(e.target.checked)}
                />
                <span> Trim whitespace</span>
              </label>
            </div>

            <div className="option-group info">
              <p>
                <strong>Note:</strong> Columns matching <code>inventory</code> or <code>availability</code> are excluded from meaningful change detection.
              </p>
            </div>
          </div>

          <div className="action-buttons">
            <button
              className="btn-primary"
              onClick={runDiff}
              disabled={!canCompare}
            >
              {isComparing ? (
                <>
                  <span className="spinner-sm" />
                  Comparing...
                </>
              ) : (
                'Compare Files'
              )}
            </button>
            <button className="btn-secondary" onClick={reset}>
              Reset
            </button>
          </div>
        </div>
      )}

      {/* Error display */}
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
      {result && csvA && csvB && (
        <div className="results-section">
          <div className="results-header">
            <h3>Comparison Results</h3>
            <div className="results-actions">
              <button className="btn-secondary" onClick={exportResults}>
                Export JSON
              </button>
              <button className="btn-secondary" onClick={reset}>
                New Comparison
              </button>
            </div>
          </div>

          <DiffView result={result} prodCsv={csvA} devCsv={csvB} />
        </div>
      )}

      <style>{`
        .diff-tab {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        /* Step indicator */
        .steps {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 1rem 0;
        }

        .step {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          opacity: 0.4;
        }

        .step.active {
          opacity: 1;
        }

        .step.complete {
          opacity: 1;
        }

        .step.complete .step-num {
          background: #4ade80;
          color: var(--bg);
        }

        .step-num {
          width: 1.5rem;
          height: 1.5rem;
          border-radius: 50%;
          background: var(--border);
          color: var(--text-muted);
          font-family: var(--font-mono);
          font-size: 0.75rem;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .step.active .step-num {
          background: var(--accent);
          color: var(--bg);
        }

        .step-label {
          font-family: var(--font-mono);
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .step.active .step-label,
        .step.complete .step-label {
          color: var(--text);
        }

        .step-line {
          width: 2rem;
          height: 1px;
          background: var(--border);
        }

        /* File inputs */
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
          display: block;
          font-family: var(--font-mono);
          font-size: 0.8rem;
          color: var(--text-muted);
          margin-bottom: 0.5rem;
        }

        /* Options panel */
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
          grid-template-columns: 1fr 1fr 1fr;
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

        .label-with-tooltip {
          display: inline-flex !important;
          align-items: center;
          gap: 0.35rem;
        }

        .tooltip-wrapper {
          position: relative;
          display: inline-flex;
          align-items: center;
        }

        .info-icon {
          width: 14px;
          height: 14px;
          opacity: 0.6;
          cursor: help;
          transition: opacity 0.15s;
        }

        .tooltip-wrapper:hover .info-icon {
          opacity: 1;
        }

        .tooltip-content {
          position: absolute;
          bottom: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%);
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 0.75rem;
          font-size: 0.7rem;
          line-height: 1.5;
          color: var(--text);
          white-space: nowrap;
          z-index: 100;
          opacity: 0;
          visibility: hidden;
          transition: opacity 0.15s, visibility 0.15s;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }

        .tooltip-content::after {
          content: '';
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          border: 6px solid transparent;
          border-top-color: var(--border);
        }

        .tooltip-wrapper:hover .tooltip-content {
          opacity: 1;
          visibility: visible;
        }

        .tooltip-content code {
          background: var(--bg);
          padding: 0.1rem 0.25rem;
          border-radius: 3px;
          font-size: 0.65rem;
        }

        .tooltip-content strong {
          color: var(--accent);
        }

        .option-group select,
        .option-group input[type="text"] {
          width: 100%;
          padding: 0.5rem;
          font-family: var(--font-mono);
          font-size: 0.8rem;
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          border-radius: 4px;
          color: var(--text);
        }

        .option-group select:focus,
        .option-group input[type="text"]:focus {
          outline: none;
          border-color: var(--accent);
        }

        .option-hint {
          display: block;
          font-size: 0.7rem;
          color: var(--text-muted);
          margin: 0.25rem 0;
        }

        .option-hint code {
          background: var(--bg-elevated);
          padding: 0.1rem 0.3rem;
          border-radius: 3px;
          font-size: 0.7rem;
        }

        .option-group.checkboxes {
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 0.5rem;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
          font-size: 0.8rem;
          color: var(--text-muted);
        }

        .checkbox-label input {
          accent-color: var(--accent);
        }

        .option-group.info p {
          font-size: 0.75rem;
          color: var(--text-muted);
          line-height: 1.5;
          margin: 0;
        }

        .option-group.info code {
          background: var(--bg-elevated);
          padding: 0.1rem 0.3rem;
          border-radius: 3px;
          font-size: 0.7rem;
          color: var(--accent);
        }

        /* Action buttons */
        .action-buttons {
          display: flex;
          gap: 0.5rem;
        }

        .btn-primary,
        .btn-secondary {
          font-family: var(--font-mono);
          font-size: 0.85rem;
          padding: 0.5rem 1rem;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
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

        /* Spinner */
        .spinner-sm {
          width: 0.875rem;
          height: 0.875rem;
          border: 2px solid rgba(0,0,0,0.2);
          border-top-color: currentColor;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Error banner */
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
          line-height: 1;
        }

        .error-banner a {
          color: inherit;
          text-decoration: underline;
          word-break: break-all;
        }

        .error-banner a:hover {
          opacity: 0.8;
        }

        /* Results section */
        .results-section {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .results-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .results-header h3 {
          font-size: 1.1rem;
          margin: 0;
        }

        .results-actions {
          display: flex;
          gap: 0.5rem;
        }
      `}</style>
    </div>
  );
}

export default DiffTab;
