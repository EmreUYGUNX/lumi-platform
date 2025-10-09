// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

import { resetEnvironmentCache } from "../../config/env.js";
import { withTemporaryEnvironment } from "../../config/testing.js";

const BASE_ENV = {
  NODE_ENV: "test",
  APP_NAME: "PerformanceTest",
  APP_PORT: "4500",
  API_BASE_URL: "http://localhost:4500",
  FRONTEND_URL: "http://localhost:3500",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/test",
  REDIS_URL: "redis://localhost:6379",
  STORAGE_BUCKET: "bucket-test",
  LOG_LEVEL: "info",
  JWT_SECRET: "1234567890123456",
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

describe("performance monitoring", () => {
  it("captures performance snapshot when monitoring started", async () => {
    await withTemporaryEnvironment(BASE_ENV, async () => {
      const perf = await import("../performance.js");
      perf.startPerformanceMonitoring();
      const snapshot = perf.getPerformanceSnapshot();
      expect(snapshot.timestamp).toBeDefined();
      expect(snapshot.memory.rss).toBeGreaterThan(0);
      expect(snapshot.eventLoop).toBeDefined();
      perf.stopPerformanceMonitoring();
    });
  });

  it("does not throw when stopping monitoring without start", async () => {
    await withTemporaryEnvironment(BASE_ENV, async () => {
      const perf = await import("../performance.js");
      expect(() => perf.stopPerformanceMonitoring()).not.toThrow();
    });
  });
});
