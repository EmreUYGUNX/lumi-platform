// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

import { loadEnvironment, onEnvironmentChange, resetEnvironmentCache } from "../env.js";
import { withTemporaryEnvironment } from "../testing.js";

const BASE_ENV = {
  NODE_ENV: "test",
  APP_NAME: "Config Test",
  APP_PORT: "4500",
  API_BASE_URL: "http://localhost:4500",
  FRONTEND_URL: "http://localhost:3500",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/test",
  REDIS_URL: "redis://localhost:6379",
  STORAGE_BUCKET: "bucket-test",
  LOG_LEVEL: "info",
  JWT_SECRET: "12345678901234567890123456789012",
  METRICS_BASIC_AUTH_USERNAME: "metrics",
  METRICS_BASIC_AUTH_PASSWORD: "metrics-pass",
  SENTRY_DSN: "",
  FEATURE_FLAGS: '{"betaCheckout":true,"abTestVariant":"A"}',
  CONFIG_HOT_RELOAD: "false",
  CONFIG_ENCRYPTION_KEY: "",
  CI: "true",
} as const;

const importConfigModule = async () => import("../index.js");

beforeEach(() => {
  jest.resetModules();
});

afterEach(() => {
  resetEnvironmentCache();
  jest.resetModules();
});

describe("environment loader", () => {
  it("normalises variables and exposes feature flags", async () => {
    await withTemporaryEnvironment(BASE_ENV, async (env) => {
      expect(env.appPort).toBe(4500);
      expect(env.featureFlags.betaCheckout).toBe(true);
      expect(env.logDirectory).toBe("logs");
      expect(env.metricsEnabled).toBe(true);
      expect(env.metricsBasicAuthUsername).toBe("metrics");
      expect(env.metricsBasicAuthPassword).toBe("metrics-pass");
      expect(env.cors.allowedOrigins).toContain("http://localhost:3000");
      expect(env.securityHeaders.enabled).toBe(true);
      expect(env.rateLimit.points).toBe(100);
      expect(env.rateLimit.durationSeconds).toBe(900);
      expect(env.rateLimit.routes.auth.points).toBe(5);
      expect(env.rateLimit.routes.auth.durationSeconds).toBe(900);
      expect(env.validation.maxBodySizeKb).toBe(512);

      const { getConfig, isFeatureEnabled, getFeatureFlags } = await importConfigModule();
      const config = getConfig();
      expect(config.app.port).toBe(4500);
      expect(config.observability.logs.directory).toBe("logs");
      expect(config.observability.logs.rotation.maxFiles).toBe("14d");
      expect(config.observability.logs.request.sampleRate).toBe(1);
      expect(config.observability.logs.request.maxBodyLength).toBe(2048);
      expect(config.observability.logs.request.redactFields).toContain("password");
      expect(config.observability.metrics.defaultMetricsInterval).toBe(5000);
      expect(config.observability.metrics.basicAuth).toEqual({
        username: "metrics",
        password: "metrics-pass",
      });
      expect(config.observability.alerting.severityThreshold).toBe("error");
      expect(config.security.cors.allowedOrigins).toContain("http://localhost:3000");
      expect(config.security.headers.frameGuard).toBe("DENY");
      expect(config.security.rateLimit.strategy).toBe("memory");
      expect(config.security.validation.strict).toBe(true);
      expect(isFeatureEnabled("betaCheckout")).toBe(true);
      const flags = getFeatureFlags();
      expect(flags).toMatchObject({ betaCheckout: true });
      expect(flags.abTestVariant).toBe(false);
    });
  });

  it("prefers the PORT variable when available", async () => {
    await withTemporaryEnvironment(
      {
        ...BASE_ENV,
        PORT: "4800",
      },
      async (env) => {
        expect(env.appPort).toBe(4800);
      },
    );
  });

  it("rejects invalid request log sampling rates", async () => {
    await expect(
      withTemporaryEnvironment(
        {
          ...BASE_ENV,
          LOG_REQUEST_SAMPLE_RATE: "1.2",
        },
        async () => {},
      ),
    ).rejects.toThrow("LOG_REQUEST_SAMPLE_RATE must be between 0 and 1");

    await expect(
      withTemporaryEnvironment(
        {
          ...BASE_ENV,
          LOG_REQUEST_SAMPLE_RATE: "-0.5",
        },
        async () => {},
      ),
    ).rejects.toThrow("LOG_REQUEST_SAMPLE_RATE must be between 0 and 1");
  });

  it("requires both metrics basic auth credentials when configured", async () => {
    await expect(
      withTemporaryEnvironment(
        {
          ...BASE_ENV,
          METRICS_BASIC_AUTH_PASSWORD: "",
        },
        async () => {},
      ),
    ).rejects.toThrow("METRICS_BASIC_AUTH_PASSWORD is required when username is provided");

    await expect(
      withTemporaryEnvironment(
        {
          ...BASE_ENV,
          METRICS_BASIC_AUTH_USERNAME: "",
        },
        async () => {},
      ),
    ).rejects.toThrow("METRICS_BASIC_AUTH_USERNAME is required when password is provided");
  });

  it("detects configuration changes on reload", async () => {
    await withTemporaryEnvironment(BASE_ENV, async () => {
      const configModule = await importConfigModule();
      const { getConfig, reloadConfiguration } = configModule;
      expect(getConfig().app.logLevel).toBe("info");

      process.env.LOG_LEVEL = "error";

      const change = reloadConfiguration("test-adjust");
      expect(change).toBeDefined();
      expect(change?.snapshot.app.logLevel).toBe("error");
      expect(change?.changedKeys).toContain("app.logLevel");
      expect(getConfig().app.logLevel).toBe("error");
    });
  });

  it("bails when no configuration values have changed", async () => {
    await withTemporaryEnvironment(BASE_ENV, async () => {
      const { reloadConfiguration } = await importConfigModule();
      const outcome = reloadConfiguration("noop");
      expect(outcome).toBeUndefined();
    });
  });

  it("coerces feature flag values into booleans", async () => {
    await withTemporaryEnvironment(
      {
        ...BASE_ENV,
        FEATURE_FLAGS: '{"betaCheckout":"yes","flagZero":"0"}',
      },
      async () => {
        const { getFeatureFlags } = await importConfigModule();
        const flags = getFeatureFlags();
        expect(flags.betaCheckout).toBe(true);
        expect(flags.flagZero).toBe(false);
      },
    );
  });

  it("prefers the generic PORT variable when provided", async () => {
    await withTemporaryEnvironment(
      {
        ...BASE_ENV,
        APP_PORT: "4100",
        PORT: "5050",
      },
      async (env) => {
        expect(env.appPort).toBe(5050);
        const { getConfig } = await importConfigModule();
        expect(getConfig().app.port).toBe(5050);
      },
    );
  });

  it("accepts the legacy CORS_ORIGIN allowlist", async () => {
    await withTemporaryEnvironment(
      {
        ...BASE_ENV,
        CORS_ORIGIN: "https://app.lumi.com,https://console.lumi.com",
        CORS_ALLOWED_ORIGINS: "",
      },
      async (env) => {
        expect(env.cors.allowedOrigins).toEqual([
          "https://app.lumi.com",
          "https://console.lumi.com",
        ]);
      },
    );
  });

  it("rejects invalid PORT definitions", async () => {
    await expect(
      withTemporaryEnvironment(
        {
          ...BASE_ENV,
          PORT: "abc",
        },
        async () => {},
      ),
    ).rejects.toThrow("PORT must be a positive integer");

    await expect(
      withTemporaryEnvironment(
        {
          ...BASE_ENV,
          PORT: "70000",
        },
        async () => {},
      ),
    ).rejects.toThrow("PORT must be between 1 and 65535");
  });

  it("ignores empty PORT values when provided as whitespace", async () => {
    await withTemporaryEnvironment(
      {
        ...BASE_ENV,
        PORT: "   ",
      },
      async (env) => {
        expect(env.appPort).toBe(Number(BASE_ENV.APP_PORT));
      },
    );
  });

  it("falls back to empty feature flags when parsing fails", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    await withTemporaryEnvironment({ ...BASE_ENV, FEATURE_FLAGS: "not-json" }, (env) => {
      expect(env.featureFlags).toEqual({});
    });

    expect(warnSpy).toHaveBeenCalledWith(
      "Invalid FEATURE_FLAGS payload, falling back to empty object.",
    );
    warnSpy.mockRestore();
  });

  it("emits environment change events on reload", async () => {
    await withTemporaryEnvironment(BASE_ENV, async () => {
      const listener = jest.fn();
      const unsubscribe = onEnvironmentChange(listener);

      loadEnvironment({ reload: true, reason: "unit" });
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ reason: "unit", env: expect.any(Object) }),
      );

      unsubscribe();
    });
  });

  it("interprets numeric feature flag payloads", async () => {
    await withTemporaryEnvironment(
      {
        ...BASE_ENV,
        FEATURE_FLAGS: '{"betaCheckout":1,"flagOff":0,"empty":""}',
      },
      async () => {
        const { getFeatureFlags } = await importConfigModule();
        const flags = getFeatureFlags();
        expect(flags.betaCheckout).toBe(true);
        expect(flags.flagOff).toBe(false);
        expect(flags.empty).toBe(false);
      },
    );
  });

  it("treats nullish feature flag values as disabled states", async () => {
    await withTemporaryEnvironment(
      {
        ...BASE_ENV,
        FEATURE_FLAGS: '{"betaCheckout":null,"variant":"true"}',
      },
      async () => {
        const { getFeatureFlags } = await importConfigModule();
        const flags = getFeatureFlags();
        expect(flags.betaCheckout).toBe(false);
        expect(flags.variant).toBe(true);
      },
    );
  });

  it("returns empty feature flags when no payload provided", async () => {
    await withTemporaryEnvironment({ ...BASE_ENV, FEATURE_FLAGS: "" }, async (env) => {
      expect(env.featureFlags).toEqual({});
    });
  });

  it("provides default feature flags when the payload is missing", async () => {
    const envObject = { ...BASE_ENV } as Record<string, string | undefined>;
    delete envObject.FEATURE_FLAGS;
    await withTemporaryEnvironment(envObject, async (env) => {
      expect(env.featureFlags).toEqual({});
    });
  });

  it("retains the Sentry DSN when provided", async () => {
    const sentryUrl = "https://example.com/dsn";
    await withTemporaryEnvironment({ ...BASE_ENV, SENTRY_DSN: sentryUrl }, async (env) => {
      expect(env.sentryDsn).toBe(sentryUrl);
    });
  });

  it("retains cached environment when reload is not requested", async () => {
    await withTemporaryEnvironment(BASE_ENV, async () => {
      const { loadEnvironment: loadEnv } = await import("../env.js");
      const first = loadEnv();
      process.env.LOG_LEVEL = "debug";
      const second = loadEnv();
      expect(second).toBe(first);
      expect(second.logLevel).toBe("info");
    });
  });

  it("defaults to the development environment when NODE_ENV is unset", async () => {
    await withTemporaryEnvironment({ ...BASE_ENV, NODE_ENV: undefined }, async (env) => {
      expect(env.nodeEnv).toBe("development");
      const { getEnvFileOrder } = await import("../env.js");
      const order = getEnvFileOrder();
      expect(order).toEqual(expect.arrayContaining([expect.stringContaining(".env.development")]));
    });
  });

  it("supports the optional encryption key", async () => {
    const KEY = "x".repeat(32);
    await withTemporaryEnvironment({ ...BASE_ENV, CONFIG_ENCRYPTION_KEY: KEY }, async (env) => {
      expect(env.configEncryptionKey).toBe(KEY);
    });
  });

  it("parses security-specific environment overrides", async () => {
    await withTemporaryEnvironment(
      {
        ...BASE_ENV,
        CORS_ALLOWED_ORIGINS: "https://one.com, https://two.com",
        CORS_EXPOSED_HEADERS: "  ",
        SECURITY_HEADERS_ENABLED: "false",
        SECURITY_HEADERS_EXPECT_CT_REPORT_URI: "https://ct.lumi.example/report",
        RATE_LIMIT_ENABLED: "1",
        RATE_LIMIT_POINTS: "20",
        RATE_LIMIT_DURATION: "120",
        RATE_LIMIT_STRATEGY: "redis",
        RATE_LIMIT_REDIS_URL: "redis://cache:6380/0",
        RATE_LIMIT_AUTH_POINTS: "10",
        RATE_LIMIT_AUTH_DURATION: "300",
        RATE_LIMIT_AUTH_BLOCK_DURATION: "1200",
        VALIDATION_MAX_BODY_KB: "256",
      },
      async (env) => {
        expect(env.cors.allowedOrigins).toEqual(["https://one.com", "https://two.com"]);
        expect(env.securityHeaders.enabled).toBe(false);
        expect(env.rateLimit.enabled).toBe(true);
        expect(env.rateLimit.points).toBe(20);
        expect(env.rateLimit.durationSeconds).toBe(120);
        expect(env.rateLimit.redis?.url).toBe("redis://cache:6380/0");
        expect(env.rateLimit.routes.auth.points).toBe(10);
        expect(env.rateLimit.routes.auth.durationSeconds).toBe(300);
        expect(env.rateLimit.routes.auth.blockDurationSeconds).toBe(1200);
        expect(env.securityHeaders.expectCt.reportUri).toBe("https://ct.lumi.example/report");
        expect(env.cors.exposedHeaders).toEqual(["X-Request-Id"]);
        expect(env.validation.maxBodySizeKb).toBe(256);
      },
    );
  });

  it("omits the encryption key when only whitespace is provided", async () => {
    await withTemporaryEnvironment({ ...BASE_ENV, CONFIG_ENCRYPTION_KEY: "   " }, async (env) => {
      expect(env.configEncryptionKey).toBeUndefined();
    });
  });

  it("parses the CI flag variants", async () => {
    await withTemporaryEnvironment({ ...BASE_ENV, CI: "1" }, async (env) => {
      expect(env.ci).toBe(true);
    });

    await withTemporaryEnvironment({ ...BASE_ENV, CI: "0" }, async (env) => {
      expect(env.ci).toBe(false);
    });
  });

  it("handles numeric CI values", async () => {
    await withTemporaryEnvironment(BASE_ENV, async () => {
      const { loadEnvironment: loadEnv } = await import("../env.js");
      process.env.CI = 1 as unknown as string;
      const env = loadEnv({ reload: true, reason: "ci-number" });
      expect(env.ci).toBe(true);
    });
  });

  it("respects explicit observability overrides", async () => {
    await withTemporaryEnvironment(
      {
        ...BASE_ENV,
        LOG_DIRECTORY: "custom-logs",
        LOG_MAX_SIZE: "50m",
        LOG_MAX_FILES: "30d",
        LOG_ENABLE_CONSOLE: "false",
        LOG_REQUEST_SAMPLE_RATE: "0.25",
        LOG_REQUEST_MAX_BODY_LENGTH: "1024",
        LOG_REQUEST_REDACT_FIELDS: "password,ssn,apiKey",
        METRICS_ENABLED: "false",
        ALERTING_ENABLED: "true",
        ALERTING_WEBHOOK_URL: "https://hooks.example.com/alerts",
        ALERTING_SEVERITY: "fatal",
        HEALTH_UPTIME_GRACE_PERIOD: "120",
      },
      async () => {
        const { getConfig } = await importConfigModule();
        const config = getConfig();
        expect(config.observability.logs.directory).toBe("custom-logs");
        expect(config.observability.logs.consoleEnabled).toBe(false);
        expect(config.observability.logs.request).toEqual({
          sampleRate: 0.25,
          maxBodyLength: 1024,
          redactFields: ["password", "ssn", "apikey"],
        });
        expect(config.observability.metrics.enabled).toBe(false);
        expect(config.observability.alerting).toMatchObject({
          enabled: true,
          webhookUrl: "https://hooks.example.com/alerts",
          severityThreshold: "fatal",
        });
        expect(config.observability.health.uptimeGracePeriodSeconds).toBe(120);
      },
    );
  });

  it("starts watching environment files when hot reload is enabled", async () => {
    const watchSpy = jest.fn(() => ({ close: jest.fn() }));
    jest.resetModules();
    jest.doMock("node:fs", () => {
      const actual = jest.requireActual("node:fs") as Record<string, unknown>;
      return {
        ...actual,
        watch: watchSpy,
        existsSync: jest.fn(() => true),
      };
    });

    const { withTemporaryEnvironment: withEnv } = await import("../testing.js");

    await withEnv({ ...BASE_ENV, NODE_ENV: "development", CONFIG_HOT_RELOAD: "true" }, async () => {
      const { loadEnvironment: loadEnv } = await import("../env.js");
      loadEnv({ reload: true, reason: "watch" });
      expect(watchSpy).toHaveBeenCalled();

      const callbackEntry = watchSpy.mock.calls[0] as unknown[] | undefined;
      const maybeCallback = callbackEntry?.[2] as ((eventType: string) => void) | undefined;
      expect(typeof maybeCallback).toBe("function");
      if (maybeCallback) {
        maybeCallback("change");
        maybeCallback("rename");
      }
    });

    jest.resetModules();
    jest.unmock("node:fs");
  });

  it("does not watch files in production despite hot reload being enabled", async () => {
    const watchSpy = jest.fn(() => ({ close: jest.fn() }));
    jest.resetModules();
    jest.doMock("node:fs", () => {
      const actual = jest.requireActual("node:fs") as Record<string, unknown>;
      return {
        ...actual,
        watch: watchSpy,
        existsSync: jest.fn(() => true),
      };
    });

    const { withTemporaryEnvironment: withEnv } = await import("../testing.js");

    await withEnv({ ...BASE_ENV, NODE_ENV: "production", CONFIG_HOT_RELOAD: "true" }, async () => {
      const { loadEnvironment: loadEnv } = await import("../env.js");
      loadEnv({ reload: true, reason: "watch" });
      expect(watchSpy).not.toHaveBeenCalled();
    });

    jest.resetModules();
    jest.unmock("node:fs");
  });

  it("skips watchers when environment files are missing", async () => {
    const watchSpy = jest.fn(() => ({ close: jest.fn() }));
    jest.resetModules();
    jest.doMock("node:fs", () => {
      const actual = jest.requireActual("node:fs") as Record<string, unknown>;
      return {
        ...actual,
        watch: watchSpy,
        existsSync: jest.fn(() => false),
      };
    });

    const { withTemporaryEnvironment: withEnv } = await import("../testing.js");

    await withEnv({ ...BASE_ENV, NODE_ENV: "development", CONFIG_HOT_RELOAD: "true" }, async () => {
      const { loadEnvironment: loadEnv } = await import("../env.js");
      loadEnv({ reload: true, reason: "watch" });
      expect(watchSpy).not.toHaveBeenCalled();
    });

    jest.resetModules();
    jest.unmock("node:fs");
  });

  it("exposes the ordered environment file list", async () => {
    const { getEnvFileOrder } = await import("../env.js");
    const order = getEnvFileOrder("test");
    expect(order).toHaveLength(5);
  });
});
