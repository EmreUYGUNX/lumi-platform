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

const loadConfigModule = async () => import("../../config/index.js");

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
let activeMetricsModule: Awaited<ReturnType<typeof import("../metrics.js")>> | undefined;

const importMetricsModule = async () => {
  const module = await import("../metrics.js");
  activeMetricsModule = module;
  return module;
};

beforeEach(() => {
  jest.resetModules();
  activeMetricsModule = undefined;
});

afterEach(() => {
  activeMetricsModule?.metricsInternals.resetForTest();
  activeMetricsModule = undefined;
  resetEnvironmentCache();
  jest.resetModules();
});

describe("metrics", () => {
  it("generates prefixed metrics and exposes registry snapshot", async () => {
    await withTemporaryEnvironment(BASE_ENV, async () => {
      const metrics = await importMetricsModule();
      const counter = metrics.createCounter({
        name: "custom_requests_total",
        help: "Counts HTTP requests.",
        labelNames: ["method", "route", "status"],
      });
      const histogram = metrics.createHistogram({
        name: "operation_duration_seconds",
        help: "Operation duration histogram.",
        labelNames: ["operation"],
        buckets: [0.001, 0.01, 0.1],
      });

      counter.labels("GET", "/unit", "200").inc();
      metrics.trackDuration(histogram, { operation: "unit" }, () => {});

      const snapshot = await metrics.getMetricsSnapshot();
      expect(snapshot).toContain("lumi_custom_requests_total");
      expect(metrics.listRegisteredMetrics()).toContain("lumi_custom_requests_total");
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
        const metrics = await importMetricsModule();
        const snapshot = await metrics.getMetricsSnapshot();
        expect(snapshot).toBe("");
      },
    );
  });

  it("reconfigures metrics on environment reload", async () => {
    await withTemporaryEnvironment(BASE_ENV, async () => {
      const metrics = await importMetricsModule();
      expect(metrics.isMetricsCollectionEnabled()).toBe(true);
      process.env.METRICS_ENABLED = "false";
      const { reloadConfiguration } = await loadConfigModule();
      reloadConfiguration("metrics-test");
      expect(metrics.isMetricsCollectionEnabled()).toBe(false);
    });
  });

  it("skips async timers when metrics disabled", async () => {
    await withTemporaryEnvironment({ ...BASE_ENV, METRICS_ENABLED: "false" }, async () => {
      const metrics = await importMetricsModule();
      const histogram = {
        startTimer: jest.fn(() => jest.fn()),
      } as unknown as Parameters<typeof metrics.trackDurationAsync>[0];
      const result = await metrics.trackDurationAsync(histogram, undefined, async () => "ok");
      expect(result).toBe("ok");
      expect(histogram.startTimer).not.toHaveBeenCalled();
    });
  });

  it("stops async timers when the wrapped operation throws", async () => {
    await withTemporaryEnvironment(BASE_ENV, async () => {
      const metrics = await importMetricsModule();
      const end = jest.fn();
      const histogram = {
        startTimer: jest.fn(() => end),
      } as unknown as Parameters<typeof metrics.trackDurationAsync>[0];
      await expect(
        metrics.trackDurationAsync(histogram, undefined, async () => {
          throw new Error("failure");
        }),
      ).rejects.toThrow("failure");
      expect(end).toHaveBeenCalled();
    });
  });

  it("reuses existing counter instances when requesting the same metric", async () => {
    await withTemporaryEnvironment(BASE_ENV, async () => {
      const metrics = await importMetricsModule();
      const first = metrics.createCounter({ name: "duplicate_counter", help: "Dup" });
      const second = metrics.createCounter({ name: "duplicate_counter", help: "Dup" });
      expect(second).toBe(first);
    });
  });

  it("records async durations when metrics are enabled", async () => {
    await withTemporaryEnvironment(BASE_ENV, async () => {
      const metrics = await importMetricsModule();
      const end = jest.fn();
      const histogram = {
        startTimer: jest.fn(() => end),
      } as unknown as Parameters<typeof metrics.trackDurationAsync>[0];
      const result = await metrics.trackDurationAsync(histogram, undefined, async () => "value");
      expect(result).toBe("value");
      expect(end).toHaveBeenCalled();
    });
  });

  it("records uptime gauge immediately when requested", async () => {
    await withTemporaryEnvironment(BASE_ENV, async () => {
      const metrics = await importMetricsModule();
      const gauge = metrics.metricsRegistry.getSingleMetric("lumi_uptime_seconds");
      expect(gauge).toBeDefined();
      const setSpy = jest.spyOn(gauge as unknown as { set: (value: number) => void }, "set");
      metrics.recordUptimeNow();
      expect(setSpy).toHaveBeenCalled();
      setSpy.mockRestore();
    });
  });

  it("does not double prefix metric names that already contain the prefix", async () => {
    await withTemporaryEnvironment(BASE_ENV, async () => {
      const metrics = await importMetricsModule();
      const gauge = metrics.createGauge({
        name: "lumi_existing_metric",
        help: "Prefixed gauge",
      });
      // @ts-expect-error Gauge exposes its name at runtime.
      expect(gauge.name).toBe("lumi_existing_metric");
    });
  });

  it("logs failures when HTTP metric instruments throw", async () => {
    await withTemporaryEnvironment(BASE_ENV, async () => {
      const metrics = await importMetricsModule();
      const { logger } = await import("../../lib/logger.js");

      interface HistogramMetric {
        startTimer: () => (labels: { status: string }) => void;
      }
      interface CounterMetric {
        labels: (method: string, route: string, status: string) => never;
      }

      const durationMetric = metrics.metricsRegistry.getSingleMetric(
        "lumi_http_request_duration_seconds",
      ) as unknown as HistogramMetric;
      const requestCounter = metrics.metricsRegistry.getSingleMetric(
        "lumi_http_requests_total",
      ) as unknown as CounterMetric;

      const timerSpy = jest.spyOn(durationMetric, "startTimer").mockReturnValue(() => {
        throw new Error("histogram failure");
      });
      const counterSpy = jest.spyOn(requestCounter, "labels").mockImplementation(() => {
        throw new Error("counter failure");
      });
      const logSpy = jest.spyOn(logger, "debug").mockReturnValue(logger);

      const timer = metrics.beginHttpRequestObservation("GET", "/failing");
      timer("200");

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining("histogram"),
        expect.objectContaining({ error: expect.any(Error) }),
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining("counter"),
        expect.objectContaining({ error: expect.any(Error) }),
      );

      logSpy.mockRestore();
      timerSpy.mockRestore();
      counterSpy.mockRestore();
    });
  });

  it("normalises and records observed HTTP metrics", async () => {
    await withTemporaryEnvironment(BASE_ENV, async () => {
      const metrics = await importMetricsModule();
      const { logger } = await import("../../lib/logger.js");

      interface HistogramLabels {
        labels: (method: string, route: string, status: string) => { observe: () => void };
      }
      interface CounterLabels {
        labels: (method: string, route: string, status: string) => { inc: () => void };
      }

      const durationMetric = metrics.metricsRegistry.getSingleMetric(
        "lumi_http_request_duration_seconds",
      ) as unknown as HistogramLabels;
      const requestCounter = metrics.metricsRegistry.getSingleMetric(
        "lumi_http_requests_total",
      ) as unknown as CounterLabels;

      const counterLabels = jest.spyOn(requestCounter, "labels").mockImplementation(() => {
        return {
          inc: () => {
            throw new Error("counter observe");
          },
        };
      });
      const histogramLabels = jest.spyOn(durationMetric, "labels").mockImplementation(() => {
        return {
          observe: () => {
            throw new Error("histogram observe");
          },
        };
      });
      const logSpy = jest.spyOn(logger, "debug").mockReturnValue(logger);

      metrics.observeHttpRequest({ method: "post", route: "orders", status: "201" }, 0.123);

      expect(counterLabels).toHaveBeenCalled();
      expect(histogramLabels).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining("counter"),
        expect.objectContaining({ error: expect.any(Error) }),
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining("histogram"),
        expect.objectContaining({
          error: expect.objectContaining({ duration: expect.any(Number) }),
        }),
      );

      logSpy.mockRestore();
      counterLabels.mockRestore();
      histogramLabels.mockRestore();
    });
  });

  it("invokes collectDefaultMetrics when enabled in configuration", async () => {
    await withTemporaryEnvironment(
      {
        ...BASE_ENV,
        METRICS_COLLECT_DEFAULT: "true",
      },
      async () => {
        jest.resetModules();
        const metrics = await importMetricsModule();
        expect(metrics.isMetricsCollectionEnabled()).toBe(true);
        expect(metrics.metricsInternals.isDefaultCollectorActive()).toBe(true);

        const snapshot = await metrics.getMetricsSnapshot();
        expect(snapshot).toContain("process_cpu_user_seconds_total");

        metrics.metricsInternals.resetForTest();
      },
    );
  });

  it("skips synchronous timers when metrics are disabled", async () => {
    await withTemporaryEnvironment(
      {
        ...BASE_ENV,
        METRICS_ENABLED: "false",
      },
      async () => {
        const metrics = await importMetricsModule();
        const end = jest.fn();
        const histogram = {
          startTimer: jest.fn(() => end),
        } as unknown as Parameters<typeof metrics.trackDuration>[0];

        metrics.trackDuration(histogram, undefined, () => {});

        expect(histogram.startTimer).not.toHaveBeenCalled();
        expect(end).not.toHaveBeenCalled();
      },
    );
  });

  it("records HTTP metrics through observation helpers", async () => {
    await withTemporaryEnvironment(BASE_ENV, async () => {
      const metrics = await importMetricsModule();
      const stopTimer = metrics.beginHttpRequestObservation("get", "api/v1/users/:id");
      stopTimer("200");

      metrics.observeHttpRequest(
        {
          method: "post",
          route: "/api/v1/users",
          status: "201",
        },
        0.245,
      );

      const snapshot = await metrics.getMetricsSnapshot();
      expect(snapshot).toContain("lumi_http_requests_total");
      expect(snapshot).toContain('method="GET"');
      expect(snapshot).toContain('method="POST"');
      expect(snapshot).toContain("lumi_http_request_duration_seconds");

      metrics.metricsInternals.resetForTest();
    });
  });

  it("applies the configured uptime sampling interval", async () => {
    await withTemporaryEnvironment(
      {
        ...BASE_ENV,
        METRICS_DEFAULT_INTERVAL: "2000",
      },
      async () => {
        jest.resetModules();
        const metrics = await importMetricsModule();
        expect(metrics.metricsInternals.getUptimeIntervalMs()).toBe(2000);
        metrics.metricsInternals.resetForTest();
      },
    );
  });
});
