import React, { useState } from 'react';
import type { DiffResult, ParsedCSV } from '../../types/csv';

interface DiffViewProps {
  result: DiffResult;
  prodCsv: ParsedCSV;
  devCsv: ParsedCSV;
  className?: string;
}

type ViewMode = 'summary' | 'added' | 'removed' | 'modified' | 'columns';

export function DiffView({ result, prodCsv, devCsv, className = '' }: DiffViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('summary');

  const hasChanges =
    result.rows_added > 0 ||
    result.rows_removed > 0 ||
    result.rows_updated > 0 ||
    result.rows_updated_excluded_only > 0;

  // Sort column changes by count
  const sortedColumnChanges = Object.entries(result.detailed_key_update_counts)
    .sort((a, b) => b[1] - a[1]);

  const totalChanges = result.rows_added + result.rows_removed + result.rows_updated;

  return (
    <div className={`diff-view ${className}`}>
      {/* File comparison header */}
      <div className="comparison-header">
        <div className="file-badge original">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <div className="file-info">
            <span className="file-name">{prodCsv.filename}</span>
            <span className="file-rows">{result.prod_row_count.toLocaleString()} rows</span>
          </div>
        </div>
        <div className="comparison-arrow">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </div>
        <div className="file-badge comparison">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <div className="file-info">
            <span className="file-name">{devCsv.filename}</span>
            <span className="file-rows">{result.dev_row_count.toLocaleString()} rows</span>
          </div>
        </div>
      </div>

      {/* No changes state */}
      {!hasChanges && (
        <div className="identical-state">
          <div className="identical-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <h3>Files are identical</h3>
          <p>No differences found between the two files.</p>
        </div>
      )}

      {/* Has changes */}
      {hasChanges && (
        <>
          {/* Summary Cards */}
          <div className="stat-cards">
            <button
              onClick={() => setViewMode(viewMode === 'added' ? 'summary' : 'added')}
              className={`stat-card added ${viewMode === 'added' ? 'active' : ''} ${result.rows_added === 0 ? 'empty' : ''}`}
              disabled={result.rows_added === 0}
            >
              <div className="stat-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="16" />
                  <line x1="8" y1="12" x2="16" y2="12" />
                </svg>
              </div>
              <div className="stat-content">
                <span className="stat-value">+{result.rows_added.toLocaleString()}</span>
                <span className="stat-label">Added</span>
              </div>
            </button>

            <button
              onClick={() => setViewMode(viewMode === 'removed' ? 'summary' : 'removed')}
              className={`stat-card removed ${viewMode === 'removed' ? 'active' : ''} ${result.rows_removed === 0 ? 'empty' : ''}`}
              disabled={result.rows_removed === 0}
            >
              <div className="stat-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="8" y1="12" x2="16" y2="12" />
                </svg>
              </div>
              <div className="stat-content">
                <span className="stat-value">-{result.rows_removed.toLocaleString()}</span>
                <span className="stat-label">Removed</span>
              </div>
            </button>

            <button
              onClick={() => setViewMode(viewMode === 'modified' ? 'summary' : 'modified')}
              className={`stat-card modified ${viewMode === 'modified' ? 'active' : ''} ${result.rows_updated === 0 ? 'empty' : ''}`}
              disabled={result.rows_updated === 0}
            >
              <div className="stat-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </div>
              <div className="stat-content">
                <span className="stat-value">~{result.rows_updated.toLocaleString()}</span>
                <span className="stat-label">
                  Modified
                  {result.rows_updated_excluded_only > 0 && (
                    <span className="stat-sublabel">+{result.rows_updated_excluded_only} inv</span>
                  )}
                </span>
              </div>
            </button>

            <button
              onClick={() => setViewMode(viewMode === 'columns' ? 'summary' : 'columns')}
              className={`stat-card columns ${viewMode === 'columns' ? 'active' : ''} ${sortedColumnChanges.length === 0 ? 'empty' : ''}`}
              disabled={sortedColumnChanges.length === 0}
            >
              <div className="stat-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="20" x2="12" y2="10" />
                  <line x1="18" y1="20" x2="18" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="16" />
                </svg>
              </div>
              <div className="stat-content">
                <span className="stat-value">{sortedColumnChanges.length}</span>
                <span className="stat-label">Columns</span>
              </div>
            </button>
          </div>

          {/* Detail Panel */}
          <div className="detail-panel">
            {/* Summary View */}
            {viewMode === 'summary' && (
              <div className="summary-view">
                <div className="summary-grid">
                  {/* Quick Stats */}
                  <div className="summary-section">
                    <h4>Overview</h4>
                    <div className="change-list">
                      {result.rows_added > 0 && (
                        <div className="change-item added">
                          <span className="change-badge">+{result.rows_added}</span>
                          <span>new rows in comparison file</span>
                        </div>
                      )}
                      {result.rows_removed > 0 && (
                        <div className="change-item removed">
                          <span className="change-badge">-{result.rows_removed}</span>
                          <span>rows missing from comparison file</span>
                        </div>
                      )}
                      {result.rows_updated > 0 && (
                        <div className="change-item modified">
                          <span className="change-badge">~{result.rows_updated}</span>
                          <span>rows with meaningful changes</span>
                        </div>
                      )}
                      {result.rows_updated_excluded_only > 0 && (
                        <div className="change-item muted">
                          <span className="change-badge">~{result.rows_updated_excluded_only}</span>
                          <span>rows with only inventory/availability changes</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Top Changed Columns */}
                  {sortedColumnChanges.length > 0 && (
                    <div className="summary-section">
                      <h4>Most Changed Columns</h4>
                      <div className="column-bars">
                        {sortedColumnChanges.slice(0, 5).map(([col, count]) => {
                          const maxCount = sortedColumnChanges[0][1];
                          const pct = Math.round((count / maxCount) * 100);
                          return (
                            <div key={col} className="column-bar-row">
                              <span className="column-name">{col}</span>
                              <div className="column-bar-wrapper">
                                <div className="column-bar" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="column-count">{count.toLocaleString()}</span>
                            </div>
                          );
                        })}
                      </div>
                      {sortedColumnChanges.length > 5 && (
                        <button className="see-all-btn" onClick={() => setViewMode('columns')}>
                          See all {sortedColumnChanges.length} columns
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Schema Differences */}
                {(result.prod_only_keys.length > 0 || result.dev_only_keys.length > 0) && (
                  <div className="schema-diff">
                    <h4>Schema Differences</h4>
                    <div className="schema-grid">
                      {result.prod_only_keys.length > 0 && (
                        <div className="schema-section removed">
                          <span className="schema-label">Only in original</span>
                          <div className="schema-columns">
                            {result.prod_only_keys.map(col => (
                              <code key={col}>{col}</code>
                            ))}
                          </div>
                        </div>
                      )}
                      {result.dev_only_keys.length > 0 && (
                        <div className="schema-section added">
                          <span className="schema-label">Only in comparison</span>
                          <div className="schema-columns">
                            {result.dev_only_keys.map(col => (
                              <code key={col}>{col}</code>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <p className="summary-hint">Click a stat card above to view example rows</p>
              </div>
            )}

            {/* Added Rows View */}
            {viewMode === 'added' && (
              <div className="detail-view">
                <div className="detail-header added">
                  <button className="back-btn" onClick={() => setViewMode('summary')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <div className="detail-title">
                    <span className="detail-count">+{result.rows_added}</span>
                    <span>rows added in comparison file</span>
                  </div>
                </div>
                <div className="example-list">
                  {Object.keys(result.example_ids_added).length > 0 ? (
                    <>
                      {Object.entries(result.example_ids_added).map(([key, info]) => (
                        <div key={key} className="example-row-expanded">
                          <div className="example-row-header">
                            <span className="primary-key">{key}</span>
                            <span className="line-info">(line {info.dev_line_num})</span>
                          </div>
                          {info.preview && info.preview.length > 0 && (
                            <div className="preview-list">
                              {info.preview.map((item, idx) => (
                                <div key={idx} className="preview-row">
                                  <span className="preview-column">{item.column}</span>
                                  <span className="preview-value added" title={item.value}>
                                    {item.value.length > 40 ? item.value.slice(0, 40) + '...' : item.value}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                      {result.rows_added > Object.keys(result.example_ids_added).length && (
                        <div className="more-indicator">
                          ...and {result.rows_added - Object.keys(result.example_ids_added).length} more rows
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="no-examples">No examples collected</div>
                  )}
                </div>
              </div>
            )}

            {/* Removed Rows View */}
            {viewMode === 'removed' && (
              <div className="detail-view">
                <div className="detail-header removed">
                  <button className="back-btn" onClick={() => setViewMode('summary')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <div className="detail-title">
                    <span className="detail-count">-{result.rows_removed}</span>
                    <span>rows removed from original file</span>
                  </div>
                </div>
                <div className="example-list">
                  {Object.keys(result.example_ids_removed).length > 0 ? (
                    <>
                      {Object.entries(result.example_ids_removed).map(([key, info]) => (
                        <div key={key} className="example-row-expanded">
                          <div className="example-row-header">
                            <span className="primary-key">{key}</span>
                            <span className="line-info">(line {info.prod_line_num})</span>
                          </div>
                          {info.preview && info.preview.length > 0 && (
                            <div className="preview-list">
                              {info.preview.map((item, idx) => (
                                <div key={idx} className="preview-row">
                                  <span className="preview-column">{item.column}</span>
                                  <span className="preview-value removed" title={item.value}>
                                    {item.value.length > 40 ? item.value.slice(0, 40) + '...' : item.value}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                      {result.rows_removed > Object.keys(result.example_ids_removed).length && (
                        <div className="more-indicator">
                          ...and {result.rows_removed - Object.keys(result.example_ids_removed).length} more rows
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="no-examples">No examples collected</div>
                  )}
                </div>
              </div>
            )}

            {/* Modified Rows View */}
            {viewMode === 'modified' && (
              <div className="detail-view">
                <div className="detail-header modified">
                  <button className="back-btn" onClick={() => setViewMode('summary')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <div className="detail-title">
                    <span className="detail-count">~{result.rows_updated}</span>
                    <span>rows with meaningful changes</span>
                    {result.rows_updated_excluded_only > 0 && (
                      <span className="detail-sub">(+{result.rows_updated_excluded_only} inventory-only)</span>
                    )}
                  </div>
                </div>
                <div className="example-list">
                  {Object.keys(result.example_ids).length > 0 ? (
                    <>
                      {Object.entries(result.example_ids).map(([key, info]) => (
                        <div key={key} className="example-row-expanded">
                          <div className="example-row-header">
                            <span className="primary-key">{key}</span>
                            {info.prod_line_num !== info.dev_line_num && (
                              <span className="line-info">
                                (line {info.prod_line_num} → {info.dev_line_num})
                              </span>
                            )}
                          </div>
                          {info.changes && info.changes.length > 0 && (
                            <div className="changes-list">
                              {info.changes.map((change, idx) => (
                                <div key={idx} className="change-row">
                                  <span className="change-column">{change.column}</span>
                                  <div className="change-values">
                                    <span className="old-value" title={change.oldValue}>
                                      {change.oldValue.length > 30 ? change.oldValue.slice(0, 30) + '...' : change.oldValue || '(empty)'}
                                    </span>
                                    <svg className="change-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M5 12h14M12 5l7 7-7 7" />
                                    </svg>
                                    <span className="new-value" title={change.newValue}>
                                      {change.newValue.length > 30 ? change.newValue.slice(0, 30) + '...' : change.newValue || '(empty)'}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                      {result.rows_updated > Object.keys(result.example_ids).length && (
                        <div className="more-indicator">
                          ...and {result.rows_updated - Object.keys(result.example_ids).length} more rows
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="no-examples">No examples collected</div>
                  )}
                </div>
              </div>
            )}

            {/* Columns View */}
            {viewMode === 'columns' && (
              <div className="detail-view">
                <div className="detail-header columns">
                  <button className="back-btn" onClick={() => setViewMode('summary')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <div className="detail-title">
                    <span className="detail-count">{sortedColumnChanges.length}</span>
                    <span>columns with changes</span>
                  </div>
                </div>
                <div className="columns-table">
                  {sortedColumnChanges.length > 0 ? (
                    <table>
                      <thead>
                        <tr>
                          <th>Column</th>
                          <th>Changes</th>
                          <th>% of Modified Rows</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedColumnChanges.map(([col, count]) => {
                          const pct = result.rows_updated > 0
                            ? Math.round((count / result.rows_updated) * 100)
                            : 0;
                          return (
                            <tr key={col}>
                              <td className="col-name">{col}</td>
                              <td className="col-count">{count.toLocaleString()}</td>
                              <td className="col-pct">
                                <div className="pct-bar-wrapper">
                                  <div className="pct-bar" style={{ width: `${Math.min(pct, 100)}%` }} />
                                </div>
                                <span>{pct}%</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div className="no-examples">No column changes detected</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      <style>{`
        .diff-view {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        /* File comparison header */
        .comparison-header {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          padding: 1rem;
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 8px;
          flex-wrap: wrap;
        }

        .file-badge {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          border-radius: 6px;
          background: var(--bg-elevated);
        }

        .file-badge svg {
          width: 1.25rem;
          height: 1.25rem;
          opacity: 0.6;
        }

        .file-badge.original svg { color: var(--text-muted); }
        .file-badge.comparison svg { color: var(--accent); }

        .file-info {
          display: flex;
          flex-direction: column;
        }

        .file-name {
          font-family: var(--font-mono);
          font-size: 0.8rem;
          font-weight: 500;
          color: var(--text);
          max-width: 150px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .file-rows {
          font-size: 0.7rem;
          color: var(--text-muted);
        }

        .comparison-arrow {
          color: var(--text-muted);
        }

        .comparison-arrow svg {
          width: 1.25rem;
          height: 1.25rem;
        }

        /* Identical state */
        .identical-state {
          text-align: center;
          padding: 3rem 2rem;
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 8px;
        }

        .identical-icon {
          width: 3.5rem;
          height: 3.5rem;
          margin: 0 auto 1rem;
          color: #4ade80;
        }

        .identical-icon svg {
          width: 100%;
          height: 100%;
        }

        .identical-state h3 {
          font-size: 1.25rem;
          margin: 0 0 0.5rem;
          color: var(--text);
        }

        .identical-state p {
          color: var(--text-muted);
          margin: 0;
          font-size: 0.9rem;
        }

        /* Stat cards */
        .stat-cards {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0.75rem;
        }

        @media (max-width: 640px) {
          .stat-cards {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        .stat-card {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem;
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
          text-align: left;
        }

        .stat-card:hover:not(:disabled) {
          border-color: var(--text-muted);
        }

        .stat-card:disabled {
          cursor: default;
          opacity: 0.5;
        }

        .stat-card.empty {
          opacity: 0.4;
        }

        .stat-card.active {
          border-width: 2px;
        }

        .stat-card.added.active { border-color: #4ade80; background: rgba(74, 222, 128, 0.05); }
        .stat-card.removed.active { border-color: #f87171; background: rgba(248, 113, 113, 0.05); }
        .stat-card.modified.active { border-color: #fbbf24; background: rgba(251, 191, 36, 0.05); }
        .stat-card.columns.active { border-color: #60a5fa; background: rgba(96, 165, 250, 0.05); }

        .stat-icon {
          width: 2rem;
          height: 2rem;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          flex-shrink: 0;
        }

        .stat-icon svg {
          width: 1.25rem;
          height: 1.25rem;
        }

        .stat-card.added .stat-icon { background: rgba(74, 222, 128, 0.15); color: #4ade80; }
        .stat-card.removed .stat-icon { background: rgba(248, 113, 113, 0.15); color: #f87171; }
        .stat-card.modified .stat-icon { background: rgba(251, 191, 36, 0.15); color: #fbbf24; }
        .stat-card.columns .stat-icon { background: rgba(96, 165, 250, 0.15); color: #60a5fa; }

        .stat-content {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .stat-value {
          font-family: var(--font-mono);
          font-size: 1.25rem;
          font-weight: 600;
          line-height: 1.2;
        }

        .stat-card.added .stat-value { color: #4ade80; }
        .stat-card.removed .stat-value { color: #f87171; }
        .stat-card.modified .stat-value { color: #fbbf24; }
        .stat-card.columns .stat-value { color: #60a5fa; }

        .stat-label {
          font-size: 0.75rem;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          gap: 0.35rem;
        }

        .stat-sublabel {
          font-size: 0.65rem;
          opacity: 0.7;
        }

        /* Detail panel */
        .detail-panel {
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 8px;
          overflow: hidden;
        }

        /* Summary view */
        .summary-view {
          padding: 1.25rem;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.25rem;
        }

        @media (max-width: 640px) {
          .summary-grid {
            grid-template-columns: 1fr;
          }
        }

        .summary-section {
          background: var(--bg-elevated);
          border-radius: 6px;
          padding: 1rem;
        }

        .summary-section h4 {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-muted);
          margin: 0 0 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .change-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .change-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.85rem;
          color: var(--text);
        }

        .change-badge {
          font-family: var(--font-mono);
          font-weight: 600;
          font-size: 0.8rem;
          min-width: 3rem;
        }

        .change-item.added .change-badge { color: #4ade80; }
        .change-item.removed .change-badge { color: #f87171; }
        .change-item.modified .change-badge { color: #fbbf24; }
        .change-item.muted .change-badge { color: var(--text-muted); }
        .change-item.muted { color: var(--text-muted); }

        /* Column bars */
        .column-bars {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .column-bar-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .column-name {
          font-family: var(--font-mono);
          font-size: 0.75rem;
          color: var(--text);
          min-width: 100px;
          max-width: 100px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .column-bar-wrapper {
          flex: 1;
          height: 6px;
          background: var(--border);
          border-radius: 3px;
          overflow: hidden;
        }

        .column-bar {
          height: 100%;
          background: #fbbf24;
          border-radius: 3px;
          transition: width 0.3s ease;
        }

        .column-count {
          font-family: var(--font-mono);
          font-size: 0.7rem;
          color: var(--text-muted);
          min-width: 40px;
          text-align: right;
        }

        .see-all-btn {
          background: none;
          border: none;
          color: var(--accent);
          font-family: var(--font-mono);
          font-size: 0.75rem;
          cursor: pointer;
          padding: 0.5rem 0 0;
        }

        .see-all-btn:hover {
          text-decoration: underline;
        }

        /* Schema diff */
        .schema-diff {
          margin-top: 1.25rem;
          background: var(--bg-elevated);
          border-radius: 6px;
          padding: 1rem;
        }

        .schema-diff h4 {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-muted);
          margin: 0 0 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .schema-grid {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .schema-section {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .schema-label {
          font-size: 0.7rem;
        }

        .schema-section.added .schema-label { color: #4ade80; }
        .schema-section.removed .schema-label { color: #f87171; }

        .schema-columns {
          display: flex;
          flex-wrap: wrap;
          gap: 0.35rem;
        }

        .schema-columns code {
          font-size: 0.7rem;
          padding: 0.2rem 0.4rem;
          border-radius: 3px;
        }

        .schema-section.added code {
          background: rgba(74, 222, 128, 0.15);
          color: #4ade80;
        }

        .schema-section.removed code {
          background: rgba(248, 113, 113, 0.15);
          color: #f87171;
        }

        .summary-hint {
          text-align: center;
          font-size: 0.75rem;
          color: var(--text-muted);
          margin: 1.25rem 0 0;
        }

        /* Detail view */
        .detail-view {
          display: flex;
          flex-direction: column;
        }

        .detail-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          border-bottom: 1px solid var(--border);
        }

        .detail-header.added { background: rgba(74, 222, 128, 0.08); }
        .detail-header.removed { background: rgba(248, 113, 113, 0.08); }
        .detail-header.modified { background: rgba(251, 191, 36, 0.08); }
        .detail-header.columns { background: rgba(96, 165, 250, 0.08); }

        .back-btn {
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 0.25rem;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.15s;
        }

        .back-btn:hover {
          color: var(--text);
        }

        .back-btn svg {
          width: 1.25rem;
          height: 1.25rem;
        }

        .detail-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.85rem;
          color: var(--text);
          flex-wrap: wrap;
        }

        .detail-count {
          font-family: var(--font-mono);
          font-weight: 600;
        }

        .detail-header.added .detail-count { color: #4ade80; }
        .detail-header.removed .detail-count { color: #f87171; }
        .detail-header.modified .detail-count { color: #fbbf24; }
        .detail-header.columns .detail-count { color: #60a5fa; }

        .detail-sub {
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        /* Example list */
        .example-list {
          max-height: 300px;
          overflow-y: auto;
        }

        .example-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          border-bottom: 1px solid var(--border);
        }

        .example-row:last-child {
          border-bottom: none;
        }

        .line-badge {
          font-family: var(--font-mono);
          font-size: 0.7rem;
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
          background: var(--bg-elevated);
          color: var(--text-muted);
        }

        .line-change {
          display: flex;
          align-items: center;
          gap: 0.35rem;
        }

        .line-change svg {
          width: 0.875rem;
          height: 0.875rem;
          color: var(--text-muted);
        }

        .line-badge.from { background: rgba(248, 113, 113, 0.15); color: #f87171; }
        .line-badge.to { background: rgba(74, 222, 128, 0.15); color: #4ade80; }

        .primary-key {
          font-family: var(--font-mono);
          font-size: 0.85rem;
          color: var(--text);
          font-weight: 500;
        }

        .line-info {
          font-size: 0.75rem;
          color: var(--text-muted);
          margin-left: auto;
        }

        /* Expanded example row with changes */
        .example-row-expanded {
          border-bottom: 1px solid var(--border);
        }

        .example-row-expanded:last-child {
          border-bottom: none;
        }

        .example-row-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          background: var(--bg-elevated);
        }

        .changes-list {
          padding: 0.5rem 1rem 0.75rem;
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .change-row {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          font-size: 0.8rem;
        }

        .change-column {
          font-family: var(--font-mono);
          font-size: 0.75rem;
          color: var(--accent);
          min-width: 100px;
          max-width: 100px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          padding-top: 0.1rem;
        }

        .change-values {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex: 1;
          min-width: 0;
        }

        .old-value, .new-value {
          font-family: var(--font-mono);
          font-size: 0.75rem;
          padding: 0.2rem 0.4rem;
          border-radius: 3px;
          max-width: 150px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .old-value {
          background: rgba(248, 113, 113, 0.15);
          color: #f87171;
          text-decoration: line-through;
        }

        .new-value {
          background: rgba(74, 222, 128, 0.15);
          color: #4ade80;
        }

        .change-arrow {
          width: 0.875rem;
          height: 0.875rem;
          color: var(--text-muted);
          flex-shrink: 0;
        }

        /* Preview list for added/removed rows */
        .preview-list {
          padding: 0.5rem 1rem 0.75rem;
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .preview-row {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          font-size: 0.8rem;
        }

        .preview-column {
          font-family: var(--font-mono);
          font-size: 0.75rem;
          color: var(--text-muted);
          min-width: 100px;
          max-width: 100px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          padding-top: 0.1rem;
        }

        .preview-value {
          font-family: var(--font-mono);
          font-size: 0.75rem;
          padding: 0.2rem 0.4rem;
          border-radius: 3px;
          max-width: 300px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .preview-value.added {
          background: rgba(74, 222, 128, 0.15);
          color: #4ade80;
        }

        .preview-value.removed {
          background: rgba(248, 113, 113, 0.15);
          color: #f87171;
        }

        .more-indicator {
          padding: 0.75rem 1rem;
          font-size: 0.8rem;
          color: var(--text-muted);
          font-style: italic;
        }

        .no-examples {
          padding: 2rem;
          text-align: center;
          color: var(--text-muted);
          font-size: 0.85rem;
        }

        /* Columns table */
        .columns-table {
          padding: 1rem;
          overflow-x: auto;
        }

        .columns-table table {
          width: 100%;
          border-collapse: collapse;
        }

        .columns-table th {
          text-align: left;
          font-size: 0.7rem;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 0 0 0.75rem;
        }

        .columns-table th:last-child {
          text-align: right;
        }

        .columns-table td {
          padding: 0.5rem 0;
          border-top: 1px solid var(--border);
        }

        .col-name {
          font-family: var(--font-mono);
          font-size: 0.8rem;
          color: var(--text);
        }

        .col-count {
          font-family: var(--font-mono);
          font-size: 0.8rem;
          color: var(--text-muted);
          text-align: center;
        }

        .col-pct {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 0.5rem;
        }

        .pct-bar-wrapper {
          width: 60px;
          height: 6px;
          background: var(--border);
          border-radius: 3px;
          overflow: hidden;
        }

        .pct-bar {
          height: 100%;
          background: #60a5fa;
          border-radius: 3px;
        }

        .col-pct span {
          font-family: var(--font-mono);
          font-size: 0.7rem;
          color: var(--text-muted);
          min-width: 35px;
          text-align: right;
        }
      `}</style>
    </div>
  );
}

export default DiffView;
