// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

import { resetEnvironmentCache } from "../../config/env.js";
import { withTemporaryEnvironment } from "../../config/testing.js";

const BASE_ENV = {
  NODE_ENV: "test",
  APP_NAME: "HealthTest",
  APP_PORT: "4500",
  API_BASE_URL: "http://localhost:4500",
  FRONTEND_URL: "http://localhost:3500",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/test",
  REDIS_URL: "redis://localhost:6379",
  STORAGE_BUCKET: "bucket-test",
  LOG_LEVEL: "info",
  JWT_SECRET: "12345678901234567890123456789012",
  METRICS_ENABLED: "true",
  METRICS_ENDPOINT: "/metrics",
  ALERTING_ENABLED: "false",
  HEALTH_UPTIME_GRACE_PERIOD: "0",
  FEATURE_FLAGS: "{}",
  CONFIG_HOT_RELOAD: "false",
  CI: "true",
} as const;

beforeEach(() => {
  jest.resetModules();
});

afterEach(() => {
  jest.resetModules();
  resetEnvironmentCache();
});

describe("health checks", () => {
  it("aggregates custom health checks", async () => {
    await withTemporaryEnvironment(BASE_ENV, async () => {
      const health = await import("../health.js");
      health.registerHealthCheck("database", () => ({
        status: "healthy",
        summary: "Database reachable",
      }));

      const snapshot = await health.evaluateHealth();
      expect(snapshot.status).toBe("healthy");
      const { database } = snapshot.components;
      expect(database).toBeDefined();
      expect(database?.status).toBe("healthy");
    });
  });

  it("flags erroring health checks as unhealthy", async () => {
    await withTemporaryEnvironment(BASE_ENV, async () => {
      const health = await import("../health.js");
      health.registerHealthCheck("redis", () => {
        throw new Error("Connection refused");
      });

      const snapshot = await health.evaluateHealth();
      expect(snapshot.status).toBe("unhealthy");
      const { redis } = snapshot.components;
      expect(redis).toBeDefined();
      expect(redis?.status).toBe("unhealthy");
      const errorDetails = (redis?.details?.error ?? {}) as { message?: string };
      expect(errorDetails.message).toBe("Connection refused");
    });
  });

  it("reports degraded status during warm-up period", async () => {
    await withTemporaryEnvironment(
      {
        ...BASE_ENV,
        HEALTH_UPTIME_GRACE_PERIOD: "120",
      },
      async () => {
        const health = await import("../health.js");
        const snapshot = await health.evaluateHealth();
        expect(snapshot.status).toBe("degraded");
        const { uptime } = snapshot.components;
        expect(uptime).toBeDefined();
        expect(uptime?.status).toBe("degraded");
      },
    );
  });
});
