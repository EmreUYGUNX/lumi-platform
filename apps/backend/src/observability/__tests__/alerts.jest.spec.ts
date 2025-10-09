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
  METRICS_ENABLED: "true",
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

  it("logs a warning when webhook dispatch cannot occur due to missing fetch", async () => {
    await withTemporaryEnvironment(BASE_ENV, async () => {
      const alerts = await import("../alerts.js");
      const loggerModule = await import("../../lib/logger.js");
      const warnSpy = jest.spyOn(loggerModule.logger, "warn");
      const previousFetch = global.fetch;
      // @ts-expect-error - simulate runtime without fetch support
      global.fetch = undefined;
      await alerts.sendAlert({
        severity: "error",
        message: "Escalation required",
        source: "webhook-test",
      });
      expect(warnSpy).toHaveBeenCalledWith(
        "Alert webhook dispatch skipped: webhook misconfigured or fetch unavailable",
        expect.objectContaining({ enabled: true, hasWebhook: true }),
      );
      warnSpy.mockRestore();
      global.fetch = previousFetch;
    });
  });

  it("logs an error when webhook dispatch fails", async () => {
    await withTemporaryEnvironment(BASE_ENV, async () => {
      const alerts = await import("../alerts.js");
      const loggerModule = await import("../../lib/logger.js");
      const errorSpy = jest.spyOn(loggerModule.logger, "error");
      fetchMock?.mockImplementationOnce(async () => {
        throw new Error("network");
      });
      await alerts.sendAlert({
        severity: "error",
        message: "Dispatch attempt",
        source: "webhook-test",
      });
      expect(errorSpy).toHaveBeenCalledWith(
        "Alert webhook dispatch failed",
        expect.objectContaining({ webhookUrl: "https://hooks.lumi.example/alerts" }),
      );
      errorSpy.mockRestore();
    });
  });

  it("suppresses alerts entirely when alerting is disabled", async () => {
    await withTemporaryEnvironment({ ...BASE_ENV, ALERTING_ENABLED: "false" }, async () => {
      const alerts = await import("../alerts.js");
      const loggerModule = await import("../../lib/logger.js");
      const debugSpy = jest.spyOn(loggerModule.logger, "debug");
      await alerts.sendAlert({ severity: "error", message: "noop", source: "disabled" });
      expect(debugSpy).toHaveBeenCalledWith("Alert suppressed because alerting is disabled", {
        source: "disabled",
      });
      debugSpy.mockRestore();
    });
  });

  it("warns when no alert channels are registered", async () => {
    await withTemporaryEnvironment(
      {
        ...BASE_ENV,
        ALERTING_WEBHOOK_URL: "",
      },
      async () => {
        const alerts = await import("../alerts.js");
        const loggerModule = await import("../../lib/logger.js");
        const warnSpy = jest.spyOn(loggerModule.logger, "warn");
        await alerts.sendAlert({ severity: "error", message: "warn", source: "no-channel" });
        expect(warnSpy).toHaveBeenCalledWith(
          "Alert dispatch skipped: no channels registered",
          expect.objectContaining({ payload: expect.objectContaining({ message: "warn" }) }),
        );
        warnSpy.mockRestore();
      },
    );
  });

  it("reports handler failures without aborting alert fan-out", async () => {
    await withTemporaryEnvironment(BASE_ENV, async () => {
      const alerts = await import("../alerts.js");
      const loggerModule = await import("../../lib/logger.js");
      const errorSpy = jest.spyOn(loggerModule.logger, "error");
      alerts.unregisterAlertChannel("default-webhook");
      alerts.registerAlertChannel("failing", () => {
        throw new Error("handler-crash");
      });
      await alerts.sendAlert({ severity: "error", message: "boom", source: "handler" });
      expect(errorSpy).toHaveBeenCalledWith(
        "Alert handler failed",
        expect.objectContaining({ name: "failing", error: expect.any(Error) }),
      );
      errorSpy.mockRestore();
    });
  });
});
