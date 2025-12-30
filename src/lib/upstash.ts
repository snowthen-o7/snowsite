/**
 * Upstash Redis utilities for Webhook Inspector
 * 
 * Data structure in Redis:
 * - endpoint:{id} -> Hash with endpoint metadata
 * - requests:{endpoint_id} -> List of request IDs (newest first)
 * - request:{id} -> Hash with full request data
 * - channel:endpoint:{id} -> Pub/Sub channel for real-time updates
 */

import { Redis } from '@upstash/redis';

// Initialize Redis client
const redis = new Redis({
  url: import.meta.env.UPSTASH_REDIS_REST_URL,
  token: import.meta.env.UPSTASH_REDIS_REST_TOKEN,
});

// TTL for data (24 hours)
const ENDPOINT_TTL = 60 * 60 * 24;
const REQUEST_TTL = 60 * 60 * 24;
const MAX_REQUESTS_PER_ENDPOINT = 100;

export interface Endpoint {
  id: string;
  name: string;
  created_at: string;
  request_count: number;
}

export interface WebhookRequest {
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

/**
 * Generate a short unique ID
 */
function generateId(length: number = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Create a new webhook endpoint
 */
export async function createEndpoint(name?: string): Promise<Endpoint> {
  const id = generateId(8);
  const endpoint: Endpoint = {
    id,
    name: name || `Endpoint ${id}`,
    created_at: new Date().toISOString(),
    request_count: 0,
  };

  // Store endpoint with TTL
  await redis.hset(`endpoint:${id}`, endpoint);
  await redis.expire(`endpoint:${id}`, ENDPOINT_TTL);

  // Initialize empty request list
  await redis.del(`requests:${id}`);

  return endpoint;
}

/**
 * Get endpoint by ID
 */
export async function getEndpoint(id: string): Promise<Endpoint | null> {
  const data = await redis.hgetall(`endpoint:${id}`);
  if (!data || Object.keys(data).length === 0) {
    return null;
  }
  return data as unknown as Endpoint;
}

/**
 * Delete an endpoint and all its requests
 */
export async function deleteEndpoint(id: string): Promise<void> {
  // Get all request IDs
  const requestIds = await redis.lrange(`requests:${id}`, 0, -1);

  // Delete all requests
  if (requestIds.length > 0) {
    const keys = requestIds.map((rid) => `request:${rid}`);
    await redis.del(...keys);
  }

  // Delete request list and endpoint
  await redis.del(`requests:${id}`);
  await redis.del(`endpoint:${id}`);
}

/**
 * Store a captured webhook request
 */
export async function storeRequest(
  endpointId: string,
  requestData: Omit<WebhookRequest, 'id' | 'endpoint_id' | 'timestamp'>
): Promise<WebhookRequest> {
  const id = generateId(12);
  const request: WebhookRequest = {
    id,
    endpoint_id: endpointId,
    timestamp: new Date().toISOString(),
    ...requestData,
  };

  // Store request with TTL
  await redis.hset(`request:${id}`, request as unknown as Record<string, unknown>);
  await redis.expire(`request:${id}`, REQUEST_TTL);

  // Add to endpoint's request list (prepend for newest-first)
  await redis.lpush(`requests:${endpointId}`, id);

  // Trim to max requests
  await redis.ltrim(`requests:${endpointId}`, 0, MAX_REQUESTS_PER_ENDPOINT - 1);

  // Refresh endpoint TTL and increment count
  await redis.hincrby(`endpoint:${endpointId}`, 'request_count', 1);
  await redis.expire(`endpoint:${endpointId}`, ENDPOINT_TTL);
  await redis.expire(`requests:${endpointId}`, ENDPOINT_TTL);

  // Publish to channel for real-time updates
  await redis.publish(`channel:endpoint:${endpointId}`, JSON.stringify({
    type: 'new_request',
    data: request,
  }));

  return request;
}

/**
 * Get recent requests for an endpoint
 */
export async function getRequests(
  endpointId: string,
  limit: number = 50
): Promise<WebhookRequest[]> {
  // Get request IDs
  const requestIds = await redis.lrange(`requests:${endpointId}`, 0, limit - 1);

  if (requestIds.length === 0) {
    return [];
  }

  // Fetch all requests
  const requests: WebhookRequest[] = [];
  for (const id of requestIds) {
    const data = await redis.hgetall(`request:${id}`);
    if (data && Object.keys(data).length > 0) {
      requests.push(data as unknown as WebhookRequest);
    }
  }

  return requests;
}

/**
 * Subscribe to endpoint updates (for SSE)
 * Note: This uses Upstash Redis HTTP-based pub/sub polling
 */
export async function pollForUpdates(
  endpointId: string,
  lastTimestamp?: string
): Promise<WebhookRequest[]> {
  // Get requests newer than lastTimestamp
  const allRequests = await getRequests(endpointId, 20);
  
  if (!lastTimestamp) {
    return allRequests;
  }

  return allRequests.filter((r) => r.timestamp > lastTimestamp);
}

export { redis };
