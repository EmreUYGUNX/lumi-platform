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

  it("records periodic metrics when metrics collection is enabled", async () => {
    const observeSpy = jest.fn();
    const setSpy = jest.fn();
    const monitorMock = {
      enable: jest.fn(),
      disable: jest.fn(),
      mean: 1_000_000,
      max: 2_000_000,
      min: 500_000,
      stddev: 250_000,
      reset: jest.fn(),
    };
    const scheduledCallbacks: (() => void)[] = [];
    const clearIntervalSpy = jest.fn();

    const monitorEventLoopDelayMock = jest.fn(() => monitorMock);
    jest.doMock("node:perf_hooks", () => ({
      monitorEventLoopDelay: monitorEventLoopDelayMock,
    }));

    jest.doMock("node:timers", () => ({
      setInterval: jest.fn((callback: () => void) => {
        scheduledCallbacks.push(callback);
        return { unref: jest.fn(), ref: jest.fn() } as unknown as NodeJS.Timeout;
      }),
      clearInterval: clearIntervalSpy,
    }));

    jest.doMock("../metrics.js", () => ({
      createGauge: () => ({ set: setSpy }),
      createHistogram: () => ({ observe: observeSpy }),
      isMetricsCollectionEnabled: jest.fn(() => true),
    }));

    await withTemporaryEnvironment(BASE_ENV, async () => {
      const perf = await import("../performance.js");
      perf.startPerformanceMonitoring();
      perf.startPerformanceMonitoring();
      scheduledCallbacks.forEach((callback) => {
        callback();
      });
      expect(observeSpy).toHaveBeenCalled();
      expect(setSpy).toHaveBeenCalled();
      perf.stopPerformanceMonitoring();
    });

    expect(monitorEventLoopDelayMock).toHaveBeenCalledTimes(1);
    expect(clearIntervalSpy).toHaveBeenCalled();
    jest.dontMock("node:perf_hooks");
    jest.dontMock("node:timers");
    jest.dontMock("../metrics.js");
  });

  it("skips sampling when metrics collection is disabled", async () => {
    const observeSpy = jest.fn();
    const setSpy = jest.fn();
    const monitorMock = {
      enable: jest.fn(),
      disable: jest.fn(),
      mean: 0,
      max: 0,
      min: 0,
      stddev: 0,
      reset: jest.fn(),
    };
    const scheduledCallbacks: (() => void)[] = [];

    jest.doMock("node:perf_hooks", () => ({
      monitorEventLoopDelay: jest.fn(() => monitorMock),
    }));

    jest.doMock("node:timers", () => ({
      setInterval: jest.fn((callback: () => void) => {
        scheduledCallbacks.push(callback);
        return { unref: jest.fn(), ref: jest.fn() } as unknown as NodeJS.Timeout;
      }),
      clearInterval: jest.fn(),
    }));

    jest.doMock("../metrics.js", () => ({
      createGauge: () => ({ set: setSpy }),
      createHistogram: () => ({ observe: observeSpy }),
      isMetricsCollectionEnabled: jest.fn(() => false),
    }));

    await withTemporaryEnvironment(BASE_ENV, async () => {
      const perf = await import("../performance.js");
      perf.startPerformanceMonitoring();
      scheduledCallbacks.forEach((callback) => {
        callback();
      });
      expect(observeSpy).not.toHaveBeenCalled();
      expect(setSpy).not.toHaveBeenCalled();
      perf.stopPerformanceMonitoring();
    });

    jest.dontMock("node:perf_hooks");
    jest.dontMock("node:timers");
    jest.dontMock("../metrics.js");
  });
});
