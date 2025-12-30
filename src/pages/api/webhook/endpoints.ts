/**
 * POST /api/webhook/endpoints - Create a new webhook endpoint
 * GET /api/webhook/endpoints?id=xxx - Get endpoint details
 * DELETE /api/webhook/endpoints?id=xxx - Delete endpoint
 */

import type { APIRoute } from 'astro';
import { createEndpoint, getEndpoint, deleteEndpoint } from '../../../lib/upstash';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json().catch(() => ({}));
    const endpoint = await createEndpoint(body.name);

    // Build webhook URL
    const url = new URL(request.url);
    const webhookUrl = `${url.origin}/api/webhook/hook/${endpoint.id}`;

    return new Response(
      JSON.stringify({
        ...endpoint,
        webhook_url: webhookUrl,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Failed to create endpoint:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create endpoint' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return new Response(
        JSON.stringify({ error: 'Endpoint ID required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const endpoint = await getEndpoint(id);

    if (!endpoint) {
      return new Response(
        JSON.stringify({ error: 'Endpoint not found' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const webhookUrl = `${url.origin}/api/webhook/hook/${endpoint.id}`;

    return new Response(
      JSON.stringify({
        ...endpoint,
        webhook_url: webhookUrl,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Failed to get endpoint:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get endpoint' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

export const DELETE: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return new Response(
        JSON.stringify({ error: 'Endpoint ID required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    await deleteEndpoint(id);

    return new Response(
      JSON.stringify({ status: 'deleted' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Failed to delete endpoint:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to delete endpoint' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
