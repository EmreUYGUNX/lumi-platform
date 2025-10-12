// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, describe, expect, it, jest } from "@jest/globals";

import { resetEnvironmentCache } from "../../config/env.js";
import { withTemporaryEnvironment } from "../../config/testing.js";

const BASE_ENV = {
  NODE_ENV: "test",
  APP_NAME: "BootstrapTest",
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
  FEATURE_FLAGS: "{}",
  CONFIG_HOT_RELOAD: "false",
  CI: "true",
} as const;

describe("observability bootstrap", () => {
  afterEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
    jest.clearAllMocks();
    jest.dontMock("../performance.js");
    jest.dontMock("../metrics.js");
    jest.dontMock("../health.js");
    jest.dontMock("../alerts.js");
    jest.dontMock("../sentry.js");
    resetEnvironmentCache();
  });

  it("initialises observability components only once", async () => {
    const startMonitoring = jest.fn();
    const recordUptime = jest.fn();

    jest.doMock("../performance.js", () => ({
      startPerformanceMonitoring: startMonitoring,
      stopPerformanceMonitoring: jest.fn(),
      getPerformanceSnapshot: jest.fn(),
    }));

    jest.doMock("../metrics.js", () => ({
      createCounter: jest.fn(),
      createGauge: jest.fn(),
      createHistogram: jest.fn(),
      isMetricsCollectionEnabled: jest.fn(() => true),
      metricsRegistry: {},
      listRegisteredMetrics: jest.fn(() => []),
      trackDuration: jest.fn(),
      trackDurationAsync: jest.fn(),
      getMetricsSnapshot: jest.fn(),
      recordUptimeNow: recordUptime,
    }));

    jest.doMock("../health.js", () => ({
      evaluateHealth: jest.fn(),
      registerHealthCheck: jest.fn(),
      unregisterHealthCheck: jest.fn(),
      listHealthChecks: jest.fn(() => []),
    }));

    jest.doMock("../alerts.js", () => ({
      sendAlert: jest.fn(),
      registerAlertChannel: jest.fn(),
      unregisterAlertChannel: jest.fn(),
      listAlertChannels: jest.fn(() => []),
    }));

    jest.doMock("../sentry.js", () => ({
      getSentryInstance: jest.fn(() => ({ flush: jest.fn() })),
      isSentryEnabled: jest.fn(() => false),
      initializeSentry: jest.fn(() => Promise.resolve()),
      setSentryUser: jest.fn(),
    }));

    await withTemporaryEnvironment(BASE_ENV, async () => {
      const module = await import("../index.js");
      module.initializeObservability();
      module.initializeObservability();

      module.createCounter({ name: "counter", help: "help" });
      module.createGauge({ name: "gauge", help: "help" });
      module.createHistogram({ name: "hist", help: "help" });
      module.trackDuration({ startTimer: jest.fn(() => jest.fn()) } as never, undefined, () => {});
      await module.trackDurationAsync(
        { startTimer: jest.fn(() => jest.fn()) } as never,
        undefined,
        async () => "done",
      );
      module.registerHealthCheck("test", () => ({
        status: "healthy",
        summary: "ok",
      }));
      module.listHealthChecks();
      module.registerAlertChannel("channel", async () => {});
      module.listAlertChannels();
      module.getSentryInstance();
      module.isSentryEnabled();
    });

    expect(startMonitoring).toHaveBeenCalledTimes(1);
    expect(recordUptime).toHaveBeenCalledTimes(1);
  });

  it("exposes observability utilities through the root index", async () => {
    await withTemporaryEnvironment(BASE_ENV, async () => {
      const module = await import("../index.js");
      expect(typeof module.initializeObservability).toBe("function");
      module.initializeObservability();
      expect(module.listAlertChannels()).toBeInstanceOf(Array);
      expect(module.listHealthChecks()).toBeInstanceOf(Array);
      module.stopPerformanceMonitoring();
    });
  });
});
