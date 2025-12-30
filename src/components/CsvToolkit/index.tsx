import React, { useState } from 'react';
import { DiffTab } from './DiffTab';
import { MergeTab } from './MergeTab';
import { DedupeTab } from './DedupeTab';
import { TransformTab } from './TransformTab';
import type { TabId } from '../../types/csv';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const TABS: Tab[] = [
  {
    id: 'diff',
    label: 'Diff',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
    description: 'Compare two CSV files and find differences',
  },
  {
    id: 'merge',
    label: 'Merge',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-7a2 2 0 012-2h2m3-4H9a2 2 0 00-2 2v7a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-1m-1 4l-3 3m0 0l-3-3m3 3V3" />
      </svg>
    ),
    description: 'Combine two CSV files by a shared key column',
  },
  {
    id: 'dedupe',
    label: 'Dedupe',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    ),
    description: 'Remove duplicate rows based on selected columns',
  },
  {
    id: 'transform',
    label: 'Transform',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
      </svg>
    ),
    description: 'Filter, sort, select columns, and reshape data',
  },
];

export function CsvToolkit() {
  const [activeTab, setActiveTab] = useState<TabId>('diff');

  return (
    <div className="csv-toolkit">
      {/* Tab Navigation */}
      <nav className="tab-navigation">
        <p className="tab-description">
          {TABS.find((t) => t.id === activeTab)?.description}
        </p>
        <div className="tab-list">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
              aria-selected={activeTab === tab.id}
              role="tab"
            >
              <span className="tab-icon">{tab.icon}</span>
              <span className="tab-label">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'diff' && <DiffTab />}
        {activeTab === 'merge' && <MergeTab />}
        {activeTab === 'dedupe' && <DedupeTab />}
        {activeTab === 'transform' && <TransformTab />}
      </div>

      {/* Footer */}
      <div className="toolkit-footer">
        Built by{' '}
        <a href="https://alexdiaz.me">Alex Diaz</a>
        {' '}• All processing happens locally in your browser
      </div>

      <style>{`
        .csv-toolkit {
          max-width: 72rem;
          margin: 0 auto;
        }

        .tab-navigation {
          margin-bottom: 1.5rem;
        }

        .tab-description {
          text-align: center;
          font-size: 0.875rem;
          color: var(--text-muted);
          margin: 0 0 1rem 0;
        }

        .tab-list {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 0.5rem;
        }

        @media (min-width: 640px) {
          .tab-list {
            gap: 0.75rem;
          }
        }

        .tab-button {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.625rem 1rem;
          font-family: var(--font-mono);
          font-size: 0.875rem;
          font-weight: 500;
          border-radius: 8px;
          border: 2px solid transparent;
          cursor: pointer;
          transition: all 0.2s ease;
          background: var(--bg-elevated);
          color: var(--text-muted);
        }

        .tab-button:hover:not(.active) {
          color: var(--text);
          border-color: var(--border);
        }

        .tab-button.active {
          background: var(--bg);
          color: var(--accent);
          border-color: var(--accent);
          box-shadow: 0 0 0 1px var(--accent), 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .tab-icon {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .tab-icon svg {
          width: 1.125rem;
          height: 1.125rem;
        }

        .tab-label {
          display: none;
        }

        @media (min-width: 480px) {
          .tab-label {
            display: inline;
          }
        }

        .tab-content {
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 1.5rem;
        }

        .toolkit-footer {
          text-align: center;
          font-size: 0.75rem;
          color: var(--text-muted);
          margin-top: 2rem;
          padding-top: 1rem;
        }

        .toolkit-footer a {
          color: var(--accent);
          text-decoration: none;
        }

        .toolkit-footer a:hover {
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}

export default CsvToolkit;
