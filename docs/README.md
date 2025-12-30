# Tools Documentation

Internal documentation for the tools available on the site. This directory is not served publicly.

## Available Tools

### [Webhook Inspector](./webhook-inspector.md)
Real-time webhook capture and inspection tool. Creates temporary endpoints that capture incoming HTTP requests for debugging API integrations.

**Key Features:**
- Unique endpoint URLs with 24-hour TTL
- Real-time updates via Server-Sent Events (SSE)
- Full request inspection (headers, body, query params)
- Powered by Upstash Redis

### [CSV Toolkit](./csv-toolkit.md)
Browser-based CSV processing tools. All operations run client-side - no data leaves the user's device.

**Key Features:**
- Diff: Compare two CSV files with line number tracking
- Merge: Join CSVs by key column (left, right, inner, outer joins)
- Dedupe: Remove duplicate rows
- Transform: Filter, sort, rename columns

## Architecture Overview

```
src/
├── components/
│   ├── CsvToolkit/          # React components for CSV tools
│   │   ├── index.tsx        # Main component with tab navigation
│   │   ├── DiffTab.tsx      # Compare two CSVs
│   │   ├── MergeTab.tsx     # Join CSVs by key
│   │   ├── DedupeTab.tsx    # Remove duplicates
│   │   ├── TransformTab.tsx # Filter/sort/reshape
│   │   ├── FileDropzone.tsx # Drag-and-drop file input
│   │   ├── DiffView.tsx     # Results visualization
│   │   └── DataPreview.tsx  # CSV data preview
│   │
│   └── WebhookInspector/    # React component for webhook tool
│       └── index.tsx        # Full inspector UI
│
├── lib/
│   ├── upstash.ts           # Redis client and data operations
│   ├── diff-engine.ts       # CSV comparison algorithm
│   └── config.ts            # Shared configuration
│
├── pages/
│   ├── tools/
│   │   ├── index.astro          # Tools landing page
│   │   ├── csv-toolkit.astro    # CSV toolkit page
│   │   └── webhook-inspector.astro # Webhook inspector page
│   │
│   └── api/webhook/
│       ├── endpoints.ts     # Create/get/delete endpoints
│       ├── hook/[id].ts     # Capture incoming webhooks
│       ├── requests.ts      # Get captured requests
│       └── stream.ts        # SSE for real-time updates
│
└── types/
    └── csv.ts               # TypeScript types for CSV operations
```

## Environment Variables

Required for Webhook Inspector:

```env
UPSTASH_REDIS_REST_URL=https://your-database.upstash.io
UPSTASH_REDIS_REST_TOKEN=AYz...your-token...
```

Get these from [Upstash Console](https://console.upstash.com/) after creating a Redis database.
