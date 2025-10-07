import { afterEach, describe, expect, it, vi } from "vitest";

import { resetEnvironmentCache } from "../env.js";
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
  FEATURE_FLAGS: '{"betaCheckout":true}',
  CONFIG_HOT_RELOAD: "false",
  CONFIG_ENCRYPTION_KEY: "",
  CI: "true",
} as const;

afterEach(() => {
  resetEnvironmentCache();
  vi.resetModules();
});

const importConfigModule = async () => import("../index.js");

describe("Environment loader", () => {
  it("normalises variables and exposes feature flags", async () => {
    await withTemporaryEnvironment(BASE_ENV, async (env) => {
      expect(env.appPort).toBe(4500);
      expect(env.featureFlags.betaCheckout).toBe(true);

      const { getConfig, isFeatureEnabled } = await importConfigModule();
      const config = getConfig();
      expect(config.app.port).toBe(4500);
      expect(isFeatureEnabled("betaCheckout")).toBe(true);
    });
  });

  it("detects configuration changes on reload", async () => {
    await withTemporaryEnvironment(BASE_ENV, async () => {
      const configModule = await import("../index.js");
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
});
