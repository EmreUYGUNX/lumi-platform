// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

import { resetEnvironmentCache } from "../../config/env.js";
import { withTemporaryEnvironment } from "../../config/testing.js";

const BASE_ENV = {
  NODE_ENV: "test",
  APP_NAME: "AlertTest",
  APP_PORT: "4500",
  API_BASE_URL: "http://localhost:4500",
  FRONTEND_URL: "http://localhost:3500",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/test",
  REDIS_URL: "redis://localhost:6379",
  STORAGE_BUCKET: "bucket-test",
  LOG_LEVEL: "info",
  JWT_SECRET: "1234567890123456",
  METRICS_ENABLED: "false",
  ALERTING_ENABLED: "true",
  ALERTING_WEBHOOK_URL: "https://hooks.lumi.example/alerts",
  ALERTING_SEVERITY: "warn",
  HEALTH_UPTIME_GRACE_PERIOD: "0",
  FEATURE_FLAGS: "{}",
  CONFIG_HOT_RELOAD: "false",
  CI: "true",
} as const;

const originalFetch = global.fetch;
let fetchMock: jest.Mock | undefined;

beforeEach(() => {
  jest.resetModules();
  fetchMock = jest.fn(async () => ({ ok: true }) as Response);
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  if (originalFetch) {
    global.fetch = originalFetch;
  }
  fetchMock = undefined;
  jest.resetModules();
  resetEnvironmentCache();
});

describe("alerting", () => {
  it("dispatches alerts when severity threshold met", async () => {
    await withTemporaryEnvironment(BASE_ENV, async () => {
      const alerts = await import("../alerts.js");

      const received: string[] = [];
      alerts.registerAlertChannel("memory", (payload) => {
        received.push(payload.message);
      });

      await alerts.sendAlert({
        severity: "error",
        message: "Service outage detected",
        source: "health-check",
      });

      expect(received).toContain("Service outage detected");
      expect(alerts.listAlertChannels()).toContain("default-webhook");
      expect(fetchMock?.mock.calls[0]?.[0]).toBe("https://hooks.lumi.example/alerts");
    });
  });

  it("suppresses alerts below severity threshold", async () => {
    await withTemporaryEnvironment(
      {
        ...BASE_ENV,
        ALERTING_SEVERITY: "error",
      },
      async () => {
        const alerts = await import("../alerts.js");
        const handler = jest.fn();
        alerts.registerAlertChannel("memory", () => {
          handler();
        });
        await alerts.sendAlert({
          severity: "info",
          message: "Informational event",
          source: "test",
        });
        expect(handler).not.toHaveBeenCalled();
      },
    );
  });

  it("removes webhook channel when alerting disabled", async () => {
    await withTemporaryEnvironment(BASE_ENV, async () => {
      const alerts = await import("../alerts.js");
      expect(alerts.listAlertChannels()).toContain("default-webhook");
    });

    jest.resetModules();

    await withTemporaryEnvironment(
      {
        ...BASE_ENV,
        ALERTING_ENABLED: "false",
      },
      async () => {
        const alerts = await import("../alerts.js");
        expect(alerts.listAlertChannels()).not.toContain("default-webhook");
      },
    );
  });
});
