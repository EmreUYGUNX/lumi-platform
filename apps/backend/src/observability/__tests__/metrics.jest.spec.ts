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
  REDIS_URL: "redis://localhost:6379",
  STORAGE_BUCKET: "bucket-test",
  LOG_LEVEL: "debug",
  JWT_SECRET: "1234567890123456",
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

beforeEach(() => {
  jest.resetModules();
});

afterEach(() => {
  resetEnvironmentCache();
  jest.resetModules();
});

const loadConfigModule = async () => import("../../config/index.js");

describe("metrics", () => {
  it("generates prefixed metrics and exposes registry snapshot", async () => {
    await withTemporaryEnvironment(BASE_ENV, async () => {
      const metrics = await import("../metrics.js");
      const counter = metrics.createCounter({
        name: "http_requests_total",
        help: "Counts HTTP requests.",
        labelNames: ["method", "status"],
      });
      const histogram = metrics.createHistogram({
        name: "operation_duration_seconds",
        help: "Operation duration histogram.",
        labelNames: ["operation"],
        buckets: [0.001, 0.01, 0.1],
      });

      counter.labels("GET", "200").inc();
      metrics.trackDuration(histogram, { operation: "unit" }, () => {});

      const snapshot = await metrics.getMetricsSnapshot();
      expect(snapshot).toContain("lumi_http_requests_total");
      expect(metrics.listRegisteredMetrics()).toContain("lumi_http_requests_total");
      expect(snapshot).toContain("lumi_operation_duration_seconds");
    });
  });

  it("returns empty snapshot when metrics disabled", async () => {
    await withTemporaryEnvironment(
      {
        ...BASE_ENV,
        METRICS_ENABLED: "false",
      },
      async () => {
        const metrics = await import("../metrics.js");
        const snapshot = await metrics.getMetricsSnapshot();
        expect(snapshot).toBe("");
      },
    );
  });

  it("reconfigures metrics on environment reload", async () => {
    await withTemporaryEnvironment(BASE_ENV, async () => {
      const metrics = await import("../metrics.js");
      expect(metrics.isMetricsCollectionEnabled()).toBe(true);
      process.env.METRICS_ENABLED = "false";
      const { reloadConfiguration } = await loadConfigModule();
      reloadConfiguration("metrics-test");
      expect(metrics.isMetricsCollectionEnabled()).toBe(false);
    });
  });
});
