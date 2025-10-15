import { createServer } from "node:net";
import type { AddressInfo } from "node:net";

// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import request from "supertest";

import { resetEnvironmentCache } from "../../config/env.js";
import { withTemporaryEnvironment } from "../../config/testing.js";
import type { ProductServiceContract } from "../../modules/product/product.service.js";
import { registerHealthCheck, unregisterHealthCheck } from "../../observability/index.js";

const BASE_ENV = {
  NODE_ENV: "test",
  APP_NAME: "HealthRouteTest",
  APP_PORT: "4700",
  API_BASE_URL: "http://localhost:4700",
  FRONTEND_URL: "http://localhost:3700",
  DATABASE_URL: "postgresql://localhost:59999/test",
  REDIS_URL: "redis://localhost:59998/0",
  STORAGE_BUCKET: "health-route-bucket",
  LOG_LEVEL: "info",
  JWT_SECRET: "12345678901234567890123456789012",
  METRICS_ENABLED: "true",
  METRICS_ENDPOINT: "/metrics",
  METRICS_PREFIX: "lumi_",
  METRICS_COLLECT_DEFAULT: "false",
  METRICS_DEFAULT_INTERVAL: "5000",
  ALERTING_ENABLED: "false",
  HEALTH_UPTIME_GRACE_PERIOD: "0",
  FEATURE_FLAGS: "{}",
  CONFIG_HOT_RELOAD: "false",
  CI: "true",
} as const;

const startProbeServer = async (): Promise<{ port: number; stop: () => Promise<void> }> =>
  new Promise((resolve, reject) => {
    const server = createServer((socket) => {
      socket.end();
    });

    server.on("error", (error) => {
      reject(error);
    });

    server.listen(0, () => {
      const address = server.address() as AddressInfo;

      resolve({
        port: address.port,
        stop: () =>
          new Promise<void>((_resolve, _reject) => {
            server.close((closeError) => {
              if (closeError) {
                _reject(closeError);
                return;
              }

              _resolve();
            });
          }),
      });
    });
  });

beforeEach(() => {
  jest.resetModules();
});

afterEach(() => {
  resetEnvironmentCache();
  jest.resetModules();
});

const PRISMA_HEALTH_CHECK_ID = "database:prisma";

const createProductServiceStub = (): ProductServiceContract => ({
  async search() {
    return {
      items: [],
      meta: {
        page: 1,
        pageSize: 0,
        totalItems: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };
  },
  async getBySlug() {
    throw new Error("Not implemented in health route tests.");
  },
});

describe("health routes", () => {
  it("returns comprehensive health snapshot with metrics when dependencies are reachable", async () => {
    const database = await startProbeServer();
    const cache = await startProbeServer();

    try {
      await withTemporaryEnvironment(
        {
          ...BASE_ENV,
          DATABASE_URL: `postgresql://localhost:${database.port}/health`,
          REDIS_URL: `redis://localhost:${cache.port}`,
        },
        async () => {
          const { createApp } = await import("../../app.js");
          const app = createApp({
            apiOptions: {
              catalogServices: {
                productService: createProductServiceStub(),
              },
            },
          });

          unregisterHealthCheck(PRISMA_HEALTH_CHECK_ID);
          registerHealthCheck(PRISMA_HEALTH_CHECK_ID, async () => ({
            status: "healthy",
            summary: "Stubbed database connectivity.",
            details: { latencyMs: 0 },
          }));

          try {
            const response = await request(app).get("/api/v1/health").expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.status).toBe("healthy");
            expect(response.body.data.components.database.status).toBe("healthy");
            expect(response.body.data.components.redis.status).toBe("healthy");
            expect(response.body.data.metrics.memory).toBeDefined();
            expect(response.body.data.metrics.cpu).toBeDefined();
            expect(response.body.data.responseTimeMs).toBeGreaterThanOrEqual(0);
            expect(response.body.meta.environment).toBe("test");
          } finally {
            unregisterHealthCheck(PRISMA_HEALTH_CHECK_ID);
          }
        },
      );
    } finally {
      await Promise.all([database.stop(), cache.stop()]);
    }
  });

  it("marks readiness as failed when dependencies are unavailable", async () => {
    await withTemporaryEnvironment(BASE_ENV, async () => {
      const { createApp } = await import("../../app.js");
      const app = createApp({
        apiOptions: {
          catalogServices: {
            productService: createProductServiceStub(),
          },
        },
      });

      unregisterHealthCheck(PRISMA_HEALTH_CHECK_ID);
      registerHealthCheck(PRISMA_HEALTH_CHECK_ID, async () => ({
        status: "unhealthy",
        summary: "Stubbed database connectivity failure.",
        severity: "error",
      }));

      try {
        const response = await request(app).get("/api/v1/health/ready").expect(503);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe("SERVICE_NOT_READY");
        expect(response.body.error.details.components.database.status).toBe("unhealthy");
        expect(response.body.error.details.components.redis.status).toBe("unhealthy");
      } finally {
        unregisterHealthCheck(PRISMA_HEALTH_CHECK_ID);
      }
    });
  });

  it("exposes a basic liveness endpoint", async () => {
    await withTemporaryEnvironment(BASE_ENV, async () => {
      const { createApp } = await import("../../app.js");
      const app = createApp({
        apiOptions: {
          catalogServices: {
            productService: createProductServiceStub(),
          },
        },
      });

      unregisterHealthCheck(PRISMA_HEALTH_CHECK_ID);

      try {
        const response = await request(app).get("/api/v1/health/live").expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe("healthy");
        expect(response.body.data).toHaveProperty("uptimeSeconds");
        expect(response.body.meta.check).toBe("liveness");
      } finally {
        unregisterHealthCheck(PRISMA_HEALTH_CHECK_ID);
      }
    });
  });
});
