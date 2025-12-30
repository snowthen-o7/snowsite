import React, { useCallback, useState, useRef } from 'react';
import { parseCSVFile } from '../../lib/csv-parser';
import type { ParsedCSV } from '../../types/csv';

interface FileDropzoneProps {
  onFileLoaded: (csv: ParsedCSV) => void;
  onError: (error: string) => void;
  label?: string;
  accept?: string;
  className?: string;
}

export function FileDropzone({
  onFileLoaded,
  onError,
  label = 'Drop CSV file here',
  accept = '.csv,.tsv,.txt',
  className = '',
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<{ rows: number; cols: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      // Validate file extension
      if (!file.name.match(/\.(csv|tsv|txt)$/i)) {
        onError('Please upload a CSV, TSV, or TXT file');
        return;
      }

      // Validate file size (max 200MB for browser processing)
      const MAX_SIZE = 200 * 1024 * 1024;
      if (file.size > MAX_SIZE) {
        onError('File too large (max 200MB). For larger files, use the CLI tool: https://github.com/snowthen-o7/data-diff-checker');
        return;
      }

      setIsLoading(true);
      setFileName(file.name);
      setFileInfo(null);

      try {
        const parsed = await parseCSVFile(file);
        setFileInfo({ rows: parsed.rowCount, cols: parsed.headers.length });
        onFileLoaded(parsed);
      } catch (err) {
        onError(err instanceof Error ? err.message : 'Failed to parse file');
        setFileName(null);
        setFileInfo(null);
      } finally {
        setIsLoading(false);
      }
    },
    [onFileLoaded, onError]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragging(false);
    }
  }, []);

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      e.target.value = '';
    },
    [handleFile]
  );

  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setFileName(null);
    setFileInfo(null);
  }, []);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      onClick={handleClick}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`dropzone ${isDragging ? 'dragging' : ''} ${isLoading ? 'loading' : ''} ${fileName ? 'has-file' : ''} ${className}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleInputChange}
        style={{ display: 'none' }}
      />

      {isLoading ? (
        <div className="dropzone-content">
          <div className="loading-container">
            <div className="spinner" />
            <div className="loading-ring" />
          </div>
          <span className="dropzone-status">Parsing file...</span>
          <span className="dropzone-filename">{fileName}</span>
        </div>
      ) : fileName && fileInfo ? (
        <div className="dropzone-content loaded">
          <div className="file-icon-container">
            <svg className="file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <div className="file-badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>
          <div className="file-details">
            <span className="dropzone-filename">{fileName}</span>
            <div className="file-stats">
              <span className="stat">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 10h18M3 14h18M3 18h18M3 6h18" />
                </svg>
                {fileInfo.rows.toLocaleString()} rows
              </span>
              <span className="stat-divider">/</span>
              <span className="stat">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 3v18M3 12h18" />
                </svg>
                {fileInfo.cols} columns
              </span>
            </div>
          </div>
          <button type="button" className="dropzone-clear" onClick={handleClear}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
            Replace
          </button>
        </div>
      ) : (
        <div className="dropzone-content empty">
          <div className="upload-icon-container">
            <div className="upload-icon-bg" />
            <svg className="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <div className="dropzone-text">
            <span className="dropzone-label">{label}</span>
            <span className="dropzone-hint">
              <span className="click-text">Click to browse</span> or drag and drop
            </span>
          </div>
          <div className="file-types">
            <span className="file-type">.csv</span>
            <span className="file-type">.tsv</span>
            <span className="file-type">.txt</span>
          </div>
        </div>
      )}

      <style>{`
        .dropzone {
          position: relative;
          cursor: pointer;
          border: 2px dashed var(--border);
          border-radius: 12px;
          background: var(--bg);
          transition: all 0.2s ease;
          min-height: 160px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .dropzone::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at center, transparent 0%, transparent 100%);
          opacity: 0;
          transition: opacity 0.2s ease;
        }

        .dropzone:hover {
          border-color: var(--text-muted);
        }

        .dropzone:hover::before {
          background: radial-gradient(circle at center, var(--accent) 0%, transparent 70%);
          opacity: 0.03;
        }

        .dropzone.dragging {
          border-color: var(--accent);
          border-style: solid;
          transform: scale(1.01);
        }

        .dropzone.dragging::before {
          background: radial-gradient(circle at center, var(--accent) 0%, transparent 70%);
          opacity: 0.08;
        }

        .dropzone.loading {
          pointer-events: none;
        }

        .dropzone.has-file {
          border-style: solid;
          border-color: #4ade80;
          background: rgba(74, 222, 128, 0.03);
        }

        .dropzone-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
          padding: 1.5rem;
          text-align: center;
          width: 100%;
        }

        .dropzone-content.empty {
          gap: 1rem;
        }

        .dropzone-content.loaded {
          flex-direction: row;
          text-align: left;
          gap: 1rem;
        }

        /* Upload icon state */
        .upload-icon-container {
          position: relative;
          width: 3rem;
          height: 3rem;
        }

        .upload-icon-bg {
          position: absolute;
          inset: 0;
          background: var(--bg-elevated);
          border-radius: 12px;
          transform: rotate(-6deg);
        }

        .upload-icon {
          position: relative;
          width: 100%;
          height: 100%;
          color: var(--text-muted);
          padding: 0.5rem;
          background: var(--bg-elevated);
          border-radius: 12px;
          transition: all 0.2s ease;
        }

        .dropzone:hover .upload-icon {
          color: var(--accent);
          transform: translateY(-2px);
        }

        .dropzone.dragging .upload-icon {
          color: var(--accent);
          transform: translateY(-4px);
        }

        .dropzone-text {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .dropzone-label {
          font-family: var(--font-mono);
          font-size: 0.9rem;
          font-weight: 500;
          color: var(--text);
        }

        .dropzone-hint {
          font-size: 0.8rem;
          color: var(--text-muted);
        }

        .click-text {
          color: var(--accent);
          font-weight: 500;
        }

        .file-types {
          display: flex;
          gap: 0.5rem;
        }

        .file-type {
          font-family: var(--font-mono);
          font-size: 0.65rem;
          color: var(--text-muted);
          background: var(--bg-elevated);
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
        }

        /* Loading state */
        .loading-container {
          position: relative;
          width: 2.5rem;
          height: 2.5rem;
        }

        .spinner {
          position: absolute;
          inset: 0;
          border: 2px solid var(--border);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .loading-ring {
          position: absolute;
          inset: -4px;
          border: 2px solid transparent;
          border-top-color: var(--accent);
          border-radius: 50%;
          opacity: 0.3;
          animation: spin 1.2s linear infinite reverse;
        }

        .dropzone-status {
          font-family: var(--font-mono);
          font-size: 0.8rem;
          color: var(--accent);
        }

        /* Loaded state */
        .file-icon-container {
          position: relative;
          flex-shrink: 0;
        }

        .file-icon {
          width: 2.5rem;
          height: 2.5rem;
          color: #4ade80;
        }

        .file-badge {
          position: absolute;
          bottom: -4px;
          right: -4px;
          width: 1.1rem;
          height: 1.1rem;
          background: #4ade80;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .file-badge svg {
          width: 0.7rem;
          height: 0.7rem;
          color: var(--bg);
        }

        .file-details {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .dropzone-filename {
          font-family: var(--font-mono);
          font-size: 0.85rem;
          font-weight: 500;
          color: var(--text);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .file-stats {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .stat {
          display: flex;
          align-items: center;
          gap: 0.3rem;
        }

        .stat svg {
          width: 0.875rem;
          height: 0.875rem;
          opacity: 0.6;
        }

        .stat-divider {
          opacity: 0.4;
        }

        .dropzone-clear {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          font-family: var(--font-mono);
          font-size: 0.75rem;
          color: var(--text-muted);
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 0.4rem 0.6rem;
          cursor: pointer;
          transition: all 0.15s ease;
          flex-shrink: 0;
        }

        .dropzone-clear svg {
          width: 0.875rem;
          height: 0.875rem;
        }

        .dropzone-clear:hover {
          color: #f87171;
          border-color: rgba(248, 113, 113, 0.5);
          background: rgba(248, 113, 113, 0.1);
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 480px) {
          .dropzone-content.loaded {
            flex-direction: column;
            text-align: center;
          }

          .file-stats {
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}

export default FileDropzone;
