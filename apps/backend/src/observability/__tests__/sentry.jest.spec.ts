// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { NodeClient } from "@sentry/node";

import { resetEnvironmentCache } from "../../config/env.js";
import { withTemporaryEnvironment } from "../../config/testing.js";

const BASE_ENV = {
  NODE_ENV: "test",
  APP_NAME: "SentryTest",
  APP_PORT: "4500",
  API_BASE_URL: "http://localhost:4500",
  FRONTEND_URL: "http://localhost:3500",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/test",
  REDIS_URL: "redis://localhost:6379",
  STORAGE_BUCKET: "bucket-test",
  LOG_LEVEL: "info",
  JWT_SECRET: "12345678901234567890123456789012",
  METRICS_ENABLED: "false",
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

const loadConfigModule = async () => import("../../config/index.js");

describe("sentry integration", () => {
  it("remains disabled when DSN is not configured", async () => {
    await withTemporaryEnvironment(BASE_ENV, async () => {
      const sentryModule = await import("../sentry.js");
      expect(sentryModule.isSentryEnabled()).toBe(false);
    });
  });

  it("initialises Sentry when DSN provided and closes on removal", async () => {
    await withTemporaryEnvironment(
      {
        ...BASE_ENV,
        SENTRY_DSN: "https://123@example.ingest.sentry.io/1",
      },
      async () => {
        const sentryLib = await import("@sentry/node");
        const initSpy = jest
          .spyOn(sentryLib, "init")
          .mockImplementation(() => undefined as unknown as NodeClient);
        const closeSpy = jest.spyOn(sentryLib, "close").mockResolvedValue(true);

        const sentryModule = await import("../sentry.js");
        expect(initSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            dsn: "https://123@example.ingest.sentry.io/1",
          }),
        );
        expect(sentryModule.isSentryEnabled()).toBe(true);

        process.env.SENTRY_DSN = "";
        const { reloadConfiguration } = await loadConfigModule();
        reloadConfiguration("sentry-disable");
        expect(closeSpy).toHaveBeenCalled();

        initSpy.mockRestore();
        closeSpy.mockRestore();
      },
    );
  });
});
