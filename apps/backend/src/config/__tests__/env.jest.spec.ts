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
  JWT_SECRET: "1234567890123456",
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

      const { getConfig, isFeatureEnabled, getFeatureFlags } = await importConfigModule();
      const config = getConfig();
      expect(config.app.port).toBe(4500);
      expect(isFeatureEnabled("betaCheckout")).toBe(true);
      const flags = getFeatureFlags();
      expect(flags).toMatchObject({ betaCheckout: true });
      expect(flags.abTestVariant).toBe(false);
    });
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
