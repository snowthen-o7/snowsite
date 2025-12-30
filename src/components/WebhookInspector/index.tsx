import React, { useState, useEffect, useCallback, useRef } from 'react';

interface WebhookRequest {
  id: string;
  endpoint_id: string;
  timestamp: string;
  method: string;
  path: string;
  query_params: Record<string, string>;
  headers: Record<string, string>;
  body: string;
  body_json: Record<string, unknown> | null;
  content_type: string;
  content_length: number;
  client_ip: string | null;
}

interface Endpoint {
  id: string;
  name: string;
  created_at: string;
  request_count: number;
  webhook_url: string;
}

type DetailTab = 'headers' | 'body' | 'query';

export function WebhookInspector() {
  const [endpoint, setEndpoint] = useState<Endpoint | null>(null);
  const [requests, setRequests] = useState<WebhookRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<WebhookRequest | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTab>('headers');
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  // Create a new endpoint
  const createEndpoint = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    try {
      const res = await fetch('/api/webhook/endpoints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      
      if (!res.ok) throw new Error('Failed to create endpoint');
      
      const data = await res.json();
      setEndpoint(data);
      setRequests([]);
      setSelectedRequest(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create endpoint');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Connect to SSE stream
  const connectToStream = useCallback(() => {
    if (!endpoint) return;
    
    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    
    const eventSource = new EventSource(
      `/api/webhook/stream?endpoint_id=${endpoint.id}`
    );
    eventSourceRef.current = eventSource;
    
    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
    };
    
    eventSource.onerror = () => {
      setIsConnected(false);
      eventSource.close();
      
      // Reconnect after a delay
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      reconnectTimeoutRef.current = window.setTimeout(() => {
        connectToStream();
      }, 3000);
    };
    
    // Handle initial data
    eventSource.addEventListener('init', (event) => {
      try {
        const data = JSON.parse(event.data);
        setRequests(data.requests || []);
      } catch (e) {
        console.error('Failed to parse init event:', e);
      }
    });
    
    // Handle new requests
    eventSource.addEventListener('request', (event) => {
      try {
        const request = JSON.parse(event.data);
        setRequests((prev) => {
          // Avoid duplicates
          if (prev.some((r) => r.id === request.id)) {
            return prev;
          }
          return [request, ...prev];
        });
      } catch (e) {
        console.error('Failed to parse request event:', e);
      }
    });
    
    // Handle timeout (server-side)
    eventSource.addEventListener('timeout', () => {
      eventSource.close();
      // Reconnect immediately
      connectToStream();
    });
    
    // Handle heartbeat (keep alive)
    eventSource.addEventListener('heartbeat', () => {
      // Connection is alive
    });
    
    return () => {
      eventSource.close();
    };
  }, [endpoint]);

  // Connect when endpoint changes
  useEffect(() => {
    if (endpoint) {
      connectToStream();
    }
    
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [endpoint, connectToStream]);

  // Copy URL to clipboard
  const copyUrl = useCallback(async () => {
    if (!endpoint) return;
    
    try {
      await navigator.clipboard.writeText(endpoint.webhook_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [endpoint]);

  // Format timestamp
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // Get method color
  const getMethodColor = (method: string) => {
    const colors: Record<string, string> = {
      GET: '#4ade80',
      POST: '#3b82f6',
      PUT: '#fbbf24',
      PATCH: '#f97316',
      DELETE: '#f87171',
    };
    return colors[method] || 'var(--text-muted)';
  };

  // Format body for display
  const formatBody = (request: WebhookRequest) => {
    if (request.body_json) {
      return JSON.stringify(request.body_json, null, 2);
    }
    return request.body || '(empty)';
  };

  return (
    <div className="webhook-inspector">
      {/* No endpoint yet - show create button */}
      {!endpoint && (
        <div className="create-section">
          <div className="create-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
            </svg>
          </div>
          <h2>Create a Webhook Endpoint</h2>
          <p>Generate a unique URL to capture incoming webhooks in real-time.</p>
          <button 
            className="btn-primary"
            onClick={createEndpoint}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="spinner" />
                Creating...
              </>
            ) : (
              'Create Endpoint'
            )}
          </button>
          {error && <p className="error">{error}</p>}
        </div>
      )}

      {/* Endpoint exists - show inspector */}
      {endpoint && (
        <>
          {/* Endpoint header */}
          <div className="endpoint-header">
            <div className="endpoint-info">
              <div className="url-label">
                <span className="label">Your Webhook URL</span>
                <span className={`status ${isConnected ? 'connected' : 'disconnected'}`}>
                  <span className="status-dot" />
                  {isConnected ? 'Live' : 'Reconnecting...'}
                </span>
              </div>
              <div className="url-row">
                <code className="webhook-url">{endpoint.webhook_url}</code>
                <button 
                  className="btn-copy"
                  onClick={copyUrl}
                  title="Copy to clipboard"
                >
                  {copied ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <div className="endpoint-actions">
              <button 
                className="btn-secondary btn-sm"
                onClick={createEndpoint}
              >
                New Endpoint
              </button>
            </div>
          </div>

          {/* Request list and detail */}
          <div className="inspector-body">
            <div className="request-list">
              <div className="list-header">
                <span>Requests ({requests.length})</span>
                {requests.length > 0 && (
                  <button 
                    className="btn-text"
                    onClick={() => {
                      setRequests([]);
                      setSelectedRequest(null);
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>

              {requests.length === 0 ? (
                <div className="empty-state">
                  <div className="pulse-ring">
                    <div className="pulse-dot" />
                  </div>
                  <p>Waiting for webhooks...</p>
                  <span>Send a request to your endpoint URL</span>
                </div>
              ) : (
                <ul className="requests">
                  {requests.map((req) => (
                    <li
                      key={req.id}
                      className={`request-item ${selectedRequest?.id === req.id ? 'selected' : ''}`}
                      onClick={() => setSelectedRequest(req)}
                    >
                      <span 
                        className="method"
                        style={{ color: getMethodColor(req.method) }}
                      >
                        {req.method}
                      </span>
                      <span className="time">{formatTime(req.timestamp)}</span>
                      <span className="size">
                        {req.content_length > 0 
                          ? req.content_length > 1024 
                            ? `${(req.content_length / 1024).toFixed(1)}KB`
                            : `${req.content_length}B`
                          : '—'
                        }
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Request detail */}
            <div className="request-detail">
              {selectedRequest ? (
                <>
                  <div className="detail-header">
                    <span 
                      className="method-badge"
                      style={{ backgroundColor: getMethodColor(selectedRequest.method) }}
                    >
                      {selectedRequest.method}
                    </span>
                    <span className="timestamp">
                      {new Date(selectedRequest.timestamp).toLocaleString()}
                    </span>
                    {selectedRequest.client_ip && (
                      <span className="client-ip">{selectedRequest.client_ip}</span>
                    )}
                  </div>

                  <div className="detail-tabs">
                    <button 
                      className={`tab ${activeTab === 'headers' ? 'active' : ''}`}
                      onClick={() => setActiveTab('headers')}
                    >
                      Headers
                      <span className="count">{Object.keys(selectedRequest.headers).length}</span>
                    </button>
                    <button 
                      className={`tab ${activeTab === 'body' ? 'active' : ''}`}
                      onClick={() => setActiveTab('body')}
                    >
                      Body
                      {selectedRequest.content_length > 0 && (
                        <span className="count">{selectedRequest.content_length}B</span>
                      )}
                    </button>
                    <button 
                      className={`tab ${activeTab === 'query' ? 'active' : ''}`}
                      onClick={() => setActiveTab('query')}
                    >
                      Query
                      {Object.keys(selectedRequest.query_params).length > 0 && (
                        <span className="count">{Object.keys(selectedRequest.query_params).length}</span>
                      )}
                    </button>
                  </div>

                  <div className="detail-content">
                    {activeTab === 'headers' && (
                      <table className="data-table">
                        <tbody>
                          {Object.entries(selectedRequest.headers).map(([key, value]) => (
                            <tr key={key}>
                              <td className="key">{key}</td>
                              <td className="value">{value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    {activeTab === 'body' && (
                      <pre className="body-content">
                        {formatBody(selectedRequest)}
                      </pre>
                    )}

                    {activeTab === 'query' && (
                      Object.keys(selectedRequest.query_params).length > 0 ? (
                        <table className="data-table">
                          <tbody>
                            {Object.entries(selectedRequest.query_params).map(([key, value]) => (
                              <tr key={key}>
                                <td className="key">{key}</td>
                                <td className="value">{value}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className="empty-tab">No query parameters</div>
                      )
                    )}
                  </div>
                </>
              ) : (
                <div className="no-selection">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59" />
                  </svg>
                  <p>Select a request to view details</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <style>{`
        .webhook-inspector {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          min-height: 400px;
        }

        /* Create section */
        .create-section {
          text-align: center;
          padding: 3rem 2rem;
        }

        .create-icon {
          width: 3rem;
          height: 3rem;
          margin: 0 auto 1rem;
          color: var(--text-muted);
        }

        .create-icon svg {
          width: 100%;
          height: 100%;
        }

        .create-section h2 {
          margin: 0 0 0.5rem 0;
          font-size: 1.25rem;
        }

        .create-section p {
          color: var(--text-muted);
          margin-bottom: 1.5rem;
          font-size: 0.9rem;
        }

        .error {
          color: #f87171;
          margin-top: 1rem;
          font-size: 0.875rem;
        }

        /* Buttons */
        .btn-primary {
          background: linear-gradient(135deg, #dc2626, var(--accent));
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 6px;
          font-family: var(--font-mono);
          font-size: 0.9rem;
          cursor: pointer;
          transition: transform 0.15s, box-shadow 0.15s;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
        }

        .btn-primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
        }

        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: transparent;
          color: var(--text-muted);
          border: 1px solid var(--border);
          padding: 0.5rem 1rem;
          border-radius: 6px;
          font-family: var(--font-mono);
          font-size: 0.8rem;
          cursor: pointer;
          transition: all 0.15s;
        }

        .btn-secondary:hover {
          color: var(--text);
          border-color: var(--text-muted);
        }

        .btn-sm {
          padding: 0.35rem 0.75rem;
          font-size: 0.75rem;
        }

        .btn-copy {
          background: var(--accent);
          color: var(--bg);
          border: none;
          width: 2rem;
          height: 2rem;
          border-radius: 4px;
          cursor: pointer;
          transition: background 0.15s;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .btn-copy svg {
          width: 1rem;
          height: 1rem;
        }

        .btn-copy:hover {
          background: var(--text);
        }

        .btn-text {
          background: none;
          border: none;
          color: var(--text-muted);
          font-family: var(--font-mono);
          font-size: 0.75rem;
          cursor: pointer;
          padding: 0;
        }

        .btn-text:hover {
          color: var(--text);
        }

        .spinner {
          width: 1rem;
          height: 1rem;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Endpoint header */
        .endpoint-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 1rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid var(--border);
          flex-wrap: wrap;
        }

        .url-label {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 0.5rem;
        }

        .label {
          font-size: 0.75rem;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .status {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.7rem;
          padding: 0.15rem 0.5rem;
          border-radius: 9999px;
        }

        .status.connected {
          background: rgba(74, 222, 128, 0.1);
          color: #4ade80;
        }

        .status.disconnected {
          background: rgba(251, 191, 36, 0.1);
          color: #fbbf24;
        }

        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
        }

        .status.connected .status-dot {
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .url-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .webhook-url {
          background: var(--bg);
          padding: 0.6rem 0.9rem;
          border-radius: 6px;
          font-size: 0.8rem;
          color: var(--accent);
          border: 1px solid var(--border);
          word-break: break-all;
        }

        /* Inspector body */
        .inspector-body {
          display: grid;
          grid-template-columns: 260px 1fr;
          gap: 1rem;
          min-height: 320px;
        }

        @media (max-width: 768px) {
          .inspector-body {
            grid-template-columns: 1fr;
          }
        }

        /* Request list */
        .request-list {
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 8px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .list-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 1rem;
          border-bottom: 1px solid var(--border);
          font-family: var(--font-mono);
          font-size: 0.8rem;
          color: var(--text-muted);
          flex-shrink: 0;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          text-align: center;
          color: var(--text-muted);
          flex: 1;
        }

        .pulse-ring {
          width: 3rem;
          height: 3rem;
          border-radius: 50%;
          border: 2px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 1rem;
          animation: pulse-ring 2s infinite;
        }

        @keyframes pulse-ring {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.7; }
        }

        .pulse-dot {
          width: 0.75rem;
          height: 0.75rem;
          background: var(--accent);
          border-radius: 50%;
          animation: pulse 1.5s infinite;
        }

        .empty-state p {
          margin: 0 0 0.25rem 0;
          font-size: 0.875rem;
        }

        .empty-state span {
          font-size: 0.75rem;
          opacity: 0.7;
        }

        .requests {
          list-style: none;
          padding: 0;
          margin: 0;
          overflow-y: auto;
          flex: 1;
        }

        .request-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.6rem 1rem;
          cursor: pointer;
          transition: background 0.15s;
          border-bottom: 1px solid var(--border);
        }

        .request-item:last-child {
          border-bottom: none;
        }

        .request-item:hover {
          background: var(--bg-hover);
        }

        .request-item.selected {
          background: rgba(59, 130, 246, 0.1);
        }

        .request-item .method {
          font-family: var(--font-mono);
          font-size: 0.7rem;
          font-weight: 600;
          min-width: 48px;
        }

        .request-item .time {
          font-family: var(--font-mono);
          font-size: 0.75rem;
          color: var(--text-muted);
          flex: 1;
        }

        .request-item .size {
          font-family: var(--font-mono);
          font-size: 0.7rem;
          color: var(--text-muted);
        }

        /* Request detail */
        .request-detail {
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 8px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .no-selection {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--text-muted);
          font-size: 0.875rem;
          gap: 0.75rem;
        }

        .no-selection svg {
          width: 2rem;
          height: 2rem;
          opacity: 0.5;
        }

        .detail-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          border-bottom: 1px solid var(--border);
          flex-wrap: wrap;
        }

        .method-badge {
          color: white;
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
          font-family: var(--font-mono);
          font-size: 0.7rem;
          font-weight: 600;
        }

        .timestamp {
          font-family: var(--font-mono);
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .client-ip {
          font-family: var(--font-mono);
          font-size: 0.7rem;
          color: var(--text-muted);
          background: var(--bg-elevated);
          padding: 0.15rem 0.4rem;
          border-radius: 4px;
          margin-left: auto;
        }

        .detail-tabs {
          display: flex;
          border-bottom: 1px solid var(--border);
          padding: 0 0.5rem;
        }

        .tab {
          background: none;
          border: none;
          padding: 0.6rem 0.75rem;
          font-family: var(--font-mono);
          font-size: 0.8rem;
          color: var(--text-muted);
          cursor: pointer;
          border-bottom: 2px solid transparent;
          margin-bottom: -1px;
          display: flex;
          align-items: center;
          gap: 0.4rem;
          transition: color 0.15s;
        }

        .tab:hover {
          color: var(--text);
        }

        .tab.active {
          color: var(--accent);
          border-bottom-color: var(--accent);
        }

        .tab .count {
          font-size: 0.65rem;
          padding: 0.1rem 0.3rem;
          background: var(--bg-elevated);
          border-radius: 3px;
        }

        .tab.active .count {
          background: rgba(248, 113, 113, 0.1);
          color: var(--accent);
        }

        .detail-content {
          padding: 1rem;
          overflow-y: auto;
          flex: 1;
        }

        .data-table {
          width: 100%;
          font-size: 0.8rem;
          border-collapse: collapse;
        }

        .data-table tr {
          border-bottom: 1px solid var(--border);
        }

        .data-table tr:last-child {
          border-bottom: none;
        }

        .data-table td {
          padding: 0.4rem 0;
          vertical-align: top;
        }

        .data-table .key {
          font-family: var(--font-mono);
          color: var(--accent);
          width: 35%;
          padding-right: 1rem;
          word-break: break-word;
        }

        .data-table .value {
          font-family: var(--font-mono);
          color: var(--text);
          word-break: break-all;
        }

        .body-content {
          background: var(--bg-elevated);
          padding: 1rem;
          border-radius: 6px;
          font-family: var(--font-mono);
          font-size: 0.8rem;
          overflow-x: auto;
          white-space: pre-wrap;
          word-break: break-all;
          margin: 0;
          border: 1px solid var(--border);
          max-height: 300px;
          overflow-y: auto;
        }

        .empty-tab {
          color: var(--text-muted);
          font-size: 0.875rem;
          text-align: center;
          padding: 2rem;
        }
      `}</style>
    </div>
  );
}

export default WebhookInspector;
