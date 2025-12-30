# Webhook Inspector

A real-time webhook capture and inspection tool for debugging API integrations, testing payment callbacks, and troubleshooting third-party webhooks.

## How It Works

### Endpoint Lifecycle

1. **Creation**: User clicks "Create Endpoint" which calls `POST /api/webhook/endpoints`
2. **Active Period**: Endpoint remains active for **24 hours** from last activity
3. **TTL Refresh**: Every incoming webhook resets the 24-hour timer
4. **Expiration**: After 24 hours of inactivity, Redis automatically deletes the endpoint and all its data

### Data Flow

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────┐
│   Client    │────▶│  /api/webhook/  │────▶│   Upstash   │
│  (Browser)  │     │   hook/[id]     │     │    Redis    │
└─────────────┘     └─────────────────┘     └─────────────┘
       │                                           │
       │            ┌─────────────────┐            │
       └───────────▶│  /api/webhook/  │◀───────────┘
         SSE        │     stream      │    Polling
                    └─────────────────┘
```

## Redis Data Structure

### Keys and TTLs

| Key Pattern | Type | TTL | Description |
|-------------|------|-----|-------------|
| `endpoint:{id}` | Hash | 24h | Endpoint metadata |
| `requests:{endpoint_id}` | List | 24h | Request IDs (newest first, max 100) |
| `request:{id}` | Hash | 24h | Full request data |

### Endpoint Hash (`endpoint:{id}`)

```json
{
  "id": "a1b2c3d4",
  "name": "Endpoint a1b2c3d4",
  "created_at": "2024-01-15T10:30:00.000Z",
  "request_count": 42
}
```

### Request Hash (`request:{id}`)

```json
{
  "id": "x1y2z3w4p5q6",
  "endpoint_id": "a1b2c3d4",
  "timestamp": "2024-01-15T10:35:22.000Z",
  "method": "POST",
  "path": "/api/webhook/hook/a1b2c3d4",
  "query_params": { "source": "stripe" },
  "headers": {
    "content-type": "application/json",
    "x-stripe-signature": "t=1234..."
  },
  "body": "{\"event\":\"payment.success\"}",
  "body_json": { "event": "payment.success" },
  "content_type": "application/json",
  "content_length": 28,
  "client_ip": "192.168.1.1"
}
```

## API Endpoints

### `POST /api/webhook/endpoints`

Creates a new webhook endpoint.

**Request Body:**
```json
{
  "name": "Optional custom name"
}
```

**Response:**
```json
{
  "id": "a1b2c3d4",
  "name": "Endpoint a1b2c3d4",
  "created_at": "2024-01-15T10:30:00.000Z",
  "request_count": 0,
  "webhook_url": "https://yoursite.com/api/webhook/hook/a1b2c3d4"
}
```

### `GET /api/webhook/endpoints?id=xxx`

Retrieves endpoint details.

### `DELETE /api/webhook/endpoints?id=xxx`

Deletes an endpoint and all its captured requests.

### `ANY /api/webhook/hook/[id]`

Captures incoming webhooks. Accepts any HTTP method (GET, POST, PUT, PATCH, DELETE).

**Response:**
```json
{
  "status": "received",
  "request_id": "x1y2z3w4p5q6",
  "endpoint_id": "a1b2c3d4",
  "timestamp": "2024-01-15T10:35:22.000Z"
}
```

**Headers:**
- `X-Request-Id`: The captured request's unique ID

**CORS:** Full CORS support via OPTIONS preflight handler.

### `GET /api/webhook/stream?endpoint_id=xxx`

Server-Sent Events (SSE) stream for real-time updates.

**Event Types:**

| Event | Description | Payload |
|-------|-------------|---------|
| `init` | Initial data on connection | `{ endpoint, requests, total }` |
| `request` | New webhook received | Full request object |
| `heartbeat` | Keep-alive ping | `{ timestamp }` |
| `timeout` | Connection timeout (reconnect) | `{ message }` |

**Connection Behavior:**
- Polls Redis every 2 seconds for new requests
- Connection times out after 25 seconds (Vercel limit)
- Client auto-reconnects on timeout
- Supports `Last-Event-ID` header for resumption

## Frontend Component

### State Management

```typescript
interface State {
  endpoint: Endpoint | null;      // Current endpoint
  requests: WebhookRequest[];     // Captured requests (newest first)
  selectedRequest: WebhookRequest | null;  // Selected for detail view
  isConnected: boolean;           // SSE connection status
  isLoading: boolean;             // Creating endpoint
  error: string | null;           // Error message
}
```

### SSE Connection Logic

```typescript
// Connect to SSE stream
const eventSource = new EventSource(`/api/webhook/stream?endpoint_id=${id}`);

eventSource.addEventListener('init', (e) => {
  // Load initial requests
  setRequests(JSON.parse(e.data).requests);
});

eventSource.addEventListener('request', (e) => {
  // Prepend new request (avoid duplicates)
  setRequests(prev => [JSON.parse(e.data), ...prev]);
});

eventSource.onerror = () => {
  // Reconnect after 3 seconds
  setTimeout(connectToStream, 3000);
};
```

### Detail View Tabs

1. **Headers**: All request headers in key-value table
2. **Body**: Raw or formatted JSON body
3. **Query**: URL query parameters

## Limits and Constraints

| Constraint | Value | Notes |
|------------|-------|-------|
| Endpoint TTL | 24 hours | Refreshes on each request |
| Max requests stored | 100 | Oldest pruned automatically |
| Request body size | ~1MB | Limited by Vercel/Redis |
| SSE timeout | 25 seconds | Client auto-reconnects |
| Poll interval | 2 seconds | Checks for new requests |

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `ENOTFOUND xxxx.upstash.io` | Invalid Redis URL | Set real Upstash credentials in `.env` |
| `Endpoint not found` | Expired or deleted | Create new endpoint |
| `Failed to capture webhook` | Redis error | Check Upstash dashboard |

### Graceful Degradation

- SSE disconnection shows "Reconnecting..." status
- Auto-reconnects with exponential backoff
- Maintains request list during reconnection

## Testing Locally

```bash
# Create endpoint
curl -X POST http://localhost:4321/api/webhook/endpoints

# Send test webhook
curl -X POST http://localhost:4321/api/webhook/hook/ENDPOINT_ID \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'

# View in browser
open http://localhost:4321/tools/webhook-inspector
```

## Dependencies

- `@upstash/redis`: Redis client for serverless
- React: UI components
- Astro: Page routing and API endpoints
