/**
 * Server-Sent Events (SSE) stream for real-time webhook updates
 * 
 * GET /api/webhook/stream?endpoint_id=xxx
 * 
 * On Vercel, SSE connections have a ~25 second timeout.
 * The client should reconnect when the connection closes.
 * Use Last-Event-ID header to resume from where you left off.
 */

import type { APIRoute } from 'astro';
import { getEndpoint, getRequests } from '../../../lib/upstash';

export const prerender = false;

// Poll interval in milliseconds
const POLL_INTERVAL = 2000;

// Max connection duration (slightly under Vercel's limit)
const MAX_DURATION = 25000;

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const endpointId = url.searchParams.get('endpoint_id');
  const lastEventId = request.headers.get('last-event-id');

  if (!endpointId) {
    return new Response(
      JSON.stringify({ error: 'endpoint_id required' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Verify endpoint exists
  const endpoint = await getEndpoint(endpointId);
  if (!endpoint) {
    return new Response(
      JSON.stringify({ error: 'Endpoint not found' }),
      {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const startTime = Date.now();
      let lastTimestamp = lastEventId || '';
      let seenIds = new Set<string>();

      // Helper to send SSE event
      const sendEvent = (event: string, data: unknown, id?: string) => {
        let message = `event: ${event}\n`;
        message += `data: ${JSON.stringify(data)}\n`;
        if (id) {
          message += `id: ${id}\n`;
        }
        message += '\n';
        controller.enqueue(encoder.encode(message));
      };

      // Send initial data
      try {
        const requests = await getRequests(endpointId, 50);
        
        // Filter to only new requests if we have a lastEventId
        let newRequests = requests;
        if (lastEventId) {
          newRequests = requests.filter(r => r.timestamp > lastEventId);
        }
        
        // Track seen IDs
        requests.forEach(r => seenIds.add(r.id));
        
        if (newRequests.length > 0) {
          lastTimestamp = newRequests[0].timestamp;
        } else if (requests.length > 0) {
          lastTimestamp = requests[0].timestamp;
        }

        sendEvent('init', {
          endpoint,
          requests: newRequests,
          total: requests.length,
        }, lastTimestamp);
      } catch (error) {
        console.error('Error sending initial data:', error);
        sendEvent('error', { message: 'Failed to fetch initial data' });
        controller.close();
        return;
      }

      // Poll for updates
      const poll = async () => {
        // Check if we should close the connection
        if (Date.now() - startTime > MAX_DURATION) {
          sendEvent('timeout', { message: 'Connection timeout, please reconnect' });
          controller.close();
          return;
        }

        try {
          const requests = await getRequests(endpointId, 20);
          
          // Find new requests we haven't seen
          const newRequests = requests.filter(r => !seenIds.has(r.id));
          
          if (newRequests.length > 0) {
            // Update tracking
            newRequests.forEach(r => seenIds.add(r.id));
            lastTimestamp = newRequests[0].timestamp;
            
            // Send each new request as an event
            for (const req of newRequests.reverse()) {
              sendEvent('request', req, req.timestamp);
            }
          }

          // Send heartbeat to keep connection alive
          sendEvent('heartbeat', { timestamp: new Date().toISOString() });

        } catch (error) {
          console.error('Error polling for updates:', error);
        }

        // Schedule next poll
        setTimeout(poll, POLL_INTERVAL);
      };

      // Start polling after a delay
      setTimeout(poll, POLL_INTERVAL);
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
};
