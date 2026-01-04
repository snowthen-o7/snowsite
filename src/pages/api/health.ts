/**
 * Health check API endpoint for Snowglobe Observatory
 * GET /api/health
 */

import type { APIRoute } from "astro";
import { reportHealth } from "../../lib/snowglobe";

export const prerender = false;

interface HealthResponse {
  status: "healthy" | "unhealthy" | "degraded";
  timestamp: string;
  services: {
    redis: {
      status: "healthy" | "unhealthy";
      latency?: number;
    };
  };
  environment: {
    nodeEnv: string;
  };
}

export const GET: APIRoute = async () => {
  const startTime = Date.now();

  try {
    // Check Redis connectivity
    let redisStatus: "healthy" | "unhealthy" = "unhealthy";
    let redisLatency = -1;

    if (
      import.meta.env.UPSTASH_REDIS_REST_URL &&
      import.meta.env.UPSTASH_REDIS_REST_TOKEN
    ) {
      try {
        const redisStart = Date.now();
        const response = await fetch(
          `${import.meta.env.UPSTASH_REDIS_REST_URL}/ping`,
          {
            headers: {
              Authorization: `Bearer ${import.meta.env.UPSTASH_REDIS_REST_TOKEN}`,
            },
          }
        );
        redisLatency = Date.now() - redisStart;
        redisStatus = response.ok ? "healthy" : "unhealthy";
      } catch {
        redisStatus = "unhealthy";
      }
    }

    const responseTimeMs = Date.now() - startTime;
    const isHealthy = redisStatus === "healthy";
    const status = isHealthy ? "healthy" : "degraded";

    const response: HealthResponse = {
      status,
      timestamp: new Date().toISOString(),
      services: {
        redis: {
          status: redisStatus,
          latency: redisLatency > 0 ? redisLatency : undefined,
        },
      },
      environment: {
        nodeEnv: import.meta.env.MODE || "unknown",
      },
    };

    // Report to Snowglobe (fire and forget)
    reportHealth(status, { responseTimeMs }).catch(() => {});

    return new Response(JSON.stringify(response), {
      status: isHealthy ? 200 : 503,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    console.error("Health check failed:", error);

    const errorResponse: HealthResponse = {
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      services: {
        redis: {
          status: "unhealthy",
        },
      },
      environment: {
        nodeEnv: import.meta.env.MODE || "unknown",
      },
    };

    // Report failure to Snowglobe
    reportHealth("down", {
      error: error instanceof Error ? error.message : "Unknown error",
    }).catch(() => {});

    return new Response(JSON.stringify(errorResponse), {
      status: 503,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  }
};
