// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Request, Response } from "express";

import { resetEnvironmentCache } from "../../config/env.js";
import { withTemporaryEnvironment } from "../../config/testing.js";

jest.mock("@sentry/node", () => {
  const scopeMock = {
    getScopeData: jest.fn(() => ({ tags: {}, extra: {}, contexts: {} })),
    getUser: jest.fn(),
    setUser: jest.fn(),
    setTags: jest.fn(),
    setExtras: jest.fn(),
    setContext: jest.fn(),
  };

  return {
    scopeMock,
    init: jest.fn(),
    close: jest.fn(async () => true),
    setTag: jest.fn(),
    setUser: jest.fn(),
    getCurrentScope: jest.fn(() => scopeMock),
    addBreadcrumb: jest.fn(),
    captureException: jest.fn(),
    httpIntegration: jest.fn(() => ({ id: "http" })),
    linkedErrorsIntegration: jest.fn(() => ({ id: "linked" })),
  };
});

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
  jest.clearAllMocks();
});

const loadConfigModule = async () => import("../../config/index.js");
const loadSentryModule = () => import("@sentry/node");

describe("sentry integration", () => {
  it("remains disabled when DSN is not configured", async () => {
    await withTemporaryEnvironment(BASE_ENV, async () => {
      const sentryModule = await import("../sentry.js");
      await new Promise<void>((resolve) => {
        setImmediate(resolve);
      });
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
        const sentryLib = (await loadSentryModule()) as unknown as {
          init: jest.Mock;
          close: jest.Mock;
        };

        const sentryModule = await import("../sentry.js");
        await sentryModule.initializeSentry();
        await new Promise<void>((resolve) => {
          setImmediate(resolve);
        });
        expect(sentryLib.init).toHaveBeenCalledWith(
          expect.objectContaining({ dsn: "https://123@example.ingest.sentry.io/1" }),
        );
        expect(sentryModule.isSentryEnabled()).toBe(true);

        process.env.SENTRY_DSN = "";
        const { reloadConfiguration } = await loadConfigModule();
        reloadConfiguration("sentry-disable");
        await new Promise<void>((resolve) => {
          setImmediate(resolve);
        });
        expect(sentryLib.close).toHaveBeenCalled();
      },
    );
  });

  it("binds request context, user metadata, and breadcrumbs", async () => {
    await withTemporaryEnvironment(
      {
        ...BASE_ENV,
        SENTRY_DSN: "https://123@example.ingest.sentry.io/1",
      },
      async () => {
        const sentryModule = await import("../sentry.js");
        await sentryModule.initializeSentry();
        await new Promise<void>((resolve) => {
          setImmediate(resolve);
        });

        const sentryLib = (await loadSentryModule()) as unknown as {
          scopeMock: {
            getScopeData: jest.Mock;
            getUser: jest.Mock;
            setUser: jest.Mock;
            setTags: jest.Mock;
            setExtras: jest.Mock;
            setContext: jest.Mock;
          };
          setTag: jest.Mock;
          setUser: jest.Mock;
          addBreadcrumb: jest.Mock;
          captureException: jest.Mock;
        };

        const scope = sentryLib.scopeMock;
        scope.setContext.mockClear();
        scope.setUser.mockClear();
        scope.setTags.mockClear();
        scope.setExtras.mockClear();
        sentryLib.setTag.mockClear();
        sentryLib.setUser.mockClear();
        sentryLib.addBreadcrumb.mockClear();
        sentryLib.captureException.mockClear();

        const middleware = sentryModule.createSentryRequestMiddleware();

        const req = {
          method: "GET",
          originalUrl: "/metrics",
          id: "req-42",
          ip: "127.0.0.1",
          get: jest.fn(() => "jest-agent"),
        } as unknown as Request;

        const { EventEmitter } = await import("node:events");
        const res = new EventEmitter() as unknown as Response & {
          locals: Record<string, unknown>;
          statusCode: number;
        };
        res.locals = { requestId: "req-42" };
        res.statusCode = 200;
        // eslint-disable-next-line unicorn/no-useless-undefined -- Tests emulate Express API which returns undefined when header missing.
        res.getHeader = ((...args: [string] | []) => undefined) as unknown as Response["getHeader"];

        middleware(req, res, () => {});

        expect(scope.setContext).toHaveBeenCalledWith(
          "request",
          expect.objectContaining({
            method: "GET",
            path: "/metrics",
            userAgent: "jest-agent",
            ip: "127.0.0.1",
            requestId: "req-42",
          }),
        );

        sentryModule.setSentryUser({ id: "user-9", email: "ops@lumi.dev", role: "admin" });
        expect(sentryLib.setUser).toHaveBeenCalledWith(
          expect.objectContaining({ id: "user-9", email: "ops@lumi.dev" }),
        );
        expect(sentryLib.setTag).toHaveBeenCalledWith("user_role", "admin");

        res.emit("finish");

        expect(sentryLib.addBreadcrumb).toHaveBeenCalledWith(
          expect.objectContaining({
            category: "http",
            data: expect.objectContaining({ lifecycle: "finish", statusCode: 200 }),
          }),
        );

        // eslint-disable-next-line unicorn/no-null -- Sentry API requires null to clear user context.
        sentryModule.setSentryUser(null);
        // eslint-disable-next-line unicorn/no-null -- Sentry API requires null to clear user context.
        expect(sentryLib.setUser).toHaveBeenCalledWith(null);
        expect(sentryLib.setTag).toHaveBeenCalledWith("user_role", "unauthenticated");

        const reqError = {
          method: "POST",
          originalUrl: "/fail",
          id: "req-error",
          ip: "127.0.0.1",
          get: jest.fn(() => "jest-agent"),
        } as unknown as Request;

        const resError = new EventEmitter() as unknown as Response & {
          locals: Record<string, unknown>;
          statusCode: number;
        };
        resError.locals = { requestId: "req-error" };
        resError.statusCode = 500;
        // eslint-disable-next-line unicorn/no-useless-undefined -- Tests emulate Express API which returns undefined when header missing.
        resError.getHeader = ((...args: [string] | []) => {}) as unknown as Response["getHeader"];

        middleware(reqError, resError, () => {});
        const failure = new Error("socket-failure");
        resError.emit("error", failure);

        expect(sentryLib.captureException).toHaveBeenCalledWith(failure);
      },
    );
  });
});
