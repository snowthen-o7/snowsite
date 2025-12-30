/**
 * Webhook capture endpoint
 * Accepts any HTTP method and captures the full request
 * 
 * Route: /api/webhook/hook/[id]
 */

import type { APIRoute } from 'astro';
import { getEndpoint, storeRequest } from '../../../../lib/upstash';

export const prerender = false;

// Handle all HTTP methods
async function handleRequest(request: Request, endpointId: string): Promise<Response> {
  try {
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

    // Capture request data
    const url = new URL(request.url);
    
    // Get body
    let body = '';
    let bodyJson: Record<string, unknown> | null = null;
    
    try {
      body = await request.text();
      if (body && request.headers.get('content-type')?.includes('application/json')) {
        bodyJson = JSON.parse(body);
      }
    } catch {
      // Body parsing failed, that's okay
    }

    // Convert headers to plain object
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    // Convert query params to plain object
    const queryParams: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      queryParams[key] = value;
    });

    // Get client IP (Vercel provides this in headers)
    const clientIp = 
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      null;

    // Store the request
    const captured = await storeRequest(endpointId, {
      method: request.method,
      path: url.pathname,
      query_params: queryParams,
      headers,
      body,
      body_json: bodyJson,
      content_type: request.headers.get('content-type') || '',
      content_length: body.length,
      client_ip: clientIp,
    });

    // Return success response
    return new Response(
      JSON.stringify({
        status: 'received',
        request_id: captured.id,
        endpoint_id: endpointId,
        timestamp: captured.timestamp,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': captured.id,
        },
      }
    );
  } catch (error) {
    console.error('Failed to capture webhook:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to capture webhook' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

// Export handlers for all HTTP methods
export const GET: APIRoute = async ({ params, request }) => {
  return handleRequest(request, params.id!);
};

export const POST: APIRoute = async ({ params, request }) => {
  return handleRequest(request, params.id!);
};

export const PUT: APIRoute = async ({ params, request }) => {
  return handleRequest(request, params.id!);
};

export const PATCH: APIRoute = async ({ params, request }) => {
  return handleRequest(request, params.id!);
};

export const DELETE: APIRoute = async ({ params, request }) => {
  return handleRequest(request, params.id!);
};

// Handle OPTIONS for CORS preflight
export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400',
    },
  });
};

// Catch-all for any other methods
export const ALL: APIRoute = async ({ params, request }) => {
  return handleRequest(request, params.id!);
};
