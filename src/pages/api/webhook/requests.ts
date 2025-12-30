/**
 * GET /api/webhook/requests?endpoint_id=xxx - Get requests for an endpoint
 */

import type { APIRoute } from 'astro';
import { getEndpoint, getRequests } from '../../../lib/upstash';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const endpointId = url.searchParams.get('endpoint_id');
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);

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

    const requests = await getRequests(endpointId, Math.min(limit, 100));

    return new Response(
      JSON.stringify({
        requests,
        count: requests.length,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Failed to get requests:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get requests' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
