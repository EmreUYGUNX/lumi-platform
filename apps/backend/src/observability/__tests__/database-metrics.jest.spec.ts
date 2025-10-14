// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

import { resetEnvironmentCache } from "../../config/env.js";
import { withTemporaryEnvironment } from "../../config/testing.js";

const BASE_ENV = {
  NODE_ENV: "test",
  APP_NAME: "MetricsTest",
  APP_PORT: "4500",
  API_BASE_URL: "http://localhost:4500",
  FRONTEND_URL: "http://localhost:3500",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/test",
  DATABASE_POOL_MIN: "5",
  DATABASE_POOL_MAX: "20",
  DATABASE_SLOW_QUERY_THRESHOLD_MS: "200",
  QUERY_TIMEOUT_MS: "5000",
  REDIS_URL: "redis://localhost:6379",
  STORAGE_BUCKET: "bucket-test",
  LOG_LEVEL: "debug",
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
  CONFIG_ENCRYPTION_KEY: "",
  CI: "true",
} as const;

beforeEach(() => {
  jest.resetModules();
});

afterEach(() => {
  resetEnvironmentCache();
  jest.resetModules();
});

describe("database metrics", () => {
  it("records database query metrics and slow query counters", async () => {
    await withTemporaryEnvironment(BASE_ENV, async () => {
      const metrics = await import("../metrics.js");
      const dbMetrics = await import("../database-metrics.js");

      dbMetrics.recordDatabaseQueryMetrics({
        model: "product",
        operation: "select",
        durationMs: 150,
        status: "ok",
        slow: true,
      });

      const snapshot = await metrics.getMetricsSnapshot();
      expect(snapshot).toContain("lumi_db_queries_total");
      expect(snapshot).toContain('model="product"');
      expect(snapshot).toContain('operation="select"');
      expect(snapshot).toContain("lumi_db_slow_queries_total");
    });
  });

  it("records non-slow query metrics with normalised labels", async () => {
    await withTemporaryEnvironment(BASE_ENV, async () => {
      const metrics = await import("../metrics.js");
      const dbMetrics = await import("../database-metrics.js");

      dbMetrics.recordDatabaseQueryMetrics({
        model: undefined,
        operation: undefined,
        durationMs: 40,
        status: "ok",
        slow: false,
      });

      const snapshot = await metrics.getMetricsSnapshot();
      expect(snapshot).toContain('model="unknown"');
      expect(snapshot).toContain('operation="unknown"');
    });
  });

  it("handles negative durations and respects measurement helper", async () => {
    await withTemporaryEnvironment(BASE_ENV, async () => {
      const metrics = await import("../metrics.js");
      const dbMetrics = await import("../database-metrics.js");

      dbMetrics.recordDatabaseQueryMetrics({
        model: "inventory",
        operation: "update",
        durationMs: -25,
        status: "ok",
        slow: false,
      });

      const observed = await metrics.getMetricsSnapshot();
      expect(observed).toContain('model="inventory"');

      const result = await dbMetrics.measureDatabaseOperation(
        { model: "checkout", operation: "insert" },
        async () => "done",
      );

      expect(result).toBe("done");
    });

    await withTemporaryEnvironment({ ...BASE_ENV, METRICS_ENABLED: "false" }, async () => {
      const { measureDatabaseOperation } = await import("../database-metrics.js");
      const outcome = await measureDatabaseOperation(
        { model: "test", operation: "noop" },
        async () => 42,
      );
      expect(outcome).toBe(42);
    });
  });

  it("skips metric recording when metrics collection disabled", async () => {
    await withTemporaryEnvironment({ ...BASE_ENV, METRICS_ENABLED: "false" }, async () => {
      const dbMetrics = await import("../database-metrics.js");
      const metrics = await import("../metrics.js");

      dbMetrics.recordDatabaseQueryMetrics({
        model: "order",
        operation: "update",
        durationMs: 75,
        status: "ok",
        slow: false,
      });

      const snapshot = await metrics.getMetricsSnapshot();
      expect(snapshot).toBe("");
    });
  });
});
