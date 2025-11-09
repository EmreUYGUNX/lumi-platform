// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import express, { type Request } from "express";
import request from "supertest";

import { resetEnvironmentCache } from "../../config/env.js";
import { withTemporaryEnvironment } from "../../config/testing.js";

const BASE_ENV = {
  NODE_ENV: "test",
  APP_NAME: "MetricsMiddlewareTest",
  APP_PORT: "4800",
  API_BASE_URL: "http://localhost:4800",
  FRONTEND_URL: "http://localhost:3800",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/test",
  REDIS_URL: "redis://localhost:6379/0",
  STORAGE_BUCKET: "metrics-middleware",
  LOG_LEVEL: "info",
  JWT_SECRET: "12345678901234567890123456789012",
  METRICS_ENABLED: "true",
  METRICS_ENDPOINT: "/metrics",
  METRICS_PREFIX: "lumi_",
  METRICS_COLLECT_DEFAULT: "false",
  METRICS_DEFAULT_INTERVAL: "5000",
  METRICS_BASIC_AUTH_USERNAME: "metrics",
  METRICS_BASIC_AUTH_PASSWORD: "metrics-pass",
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
  resetEnvironmentCache();
  jest.resetModules();
});

describe("metrics middleware", () => {
  it("records HTTP metrics for handled requests", async () => {
    await withTemporaryEnvironment(BASE_ENV, async () => {
      const metrics = await import("../../observability/metrics.js");

      const { createMetricsMiddleware } = await import("../metrics.js");

      const app = express();
      app.use(createMetricsMiddleware());
      app.get("/users/:id", (req, res) => {
        res.json({
          success: true,
          data: {
            id: req.params.id,
          },
        });
      });

      await request(app).get("/users/42").expect(200);

      const snapshot = await metrics.getMetricsSnapshot();
      expect(snapshot).toContain("lumi_http_requests_total");
      expect(snapshot).toContain('route="/users/:id"');
      expect(snapshot).toContain('status="200"');
    });
  });

  it("returns a passthrough middleware when metrics collection is disabled", async () => {
    const observeHttpRequest = jest.fn();
    const isMetricsCollectionEnabled = jest.fn(() => false);

    jest.doMock("../../observability/index.js", () => ({
      __esModule: true,
      isMetricsCollectionEnabled,
      observeHttpRequest,
    }));

    const { createMetricsMiddleware } = await import("../metrics.js");
    const middleware = createMetricsMiddleware();

    const next = jest.fn();
    middleware({} as express.Request, {} as express.Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(observeHttpRequest).not.toHaveBeenCalled();
  });

  it("re-checks the runtime toggle before instrumenting each request", async () => {
    const observeHttpRequest = jest.fn();
    const isMetricsCollectionEnabled = jest
      .fn()
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false);

    jest.doMock("../../observability/index.js", () => ({
      __esModule: true,
      isMetricsCollectionEnabled,
      observeHttpRequest,
    }));

    const { createMetricsMiddleware } = await import("../metrics.js");
    const middleware = createMetricsMiddleware();

    const next = jest.fn();
    const res = {
      once: jest.fn(),
    } as unknown as express.Response;

    middleware({} as express.Request, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.once).not.toHaveBeenCalled();
    expect(observeHttpRequest).not.toHaveBeenCalled();
  });

  it("normalises metadata and records each request only once", async () => {
    const observeHttpRequest = jest.fn();
    const isMetricsCollectionEnabled = jest.fn(() => true);

    jest.doMock("../../observability/index.js", () => ({
      __esModule: true,
      isMetricsCollectionEnabled,
      observeHttpRequest,
    }));

    const { createMetricsMiddleware } = await import("../metrics.js");
    const middleware = createMetricsMiddleware();

    const next = jest.fn();
    const invoke = (req: Partial<express.Request>, statusCode: number) => {
      const localHandlers: Record<string, (() => void)[]> = {};
      const res: Partial<express.Response> = {
        statusCode,
      };
      const typedRes = res as express.Response;
      res.once = jest.fn((event: string, handler: () => void) => {
        localHandlers[event] ??= [];
        localHandlers[event]!.push(handler);
        return typedRes;
      });
      res.setHeader = jest.fn(() => typedRes);
      res.status = jest.fn(() => typedRes);

      middleware(req as express.Request, typedRes, next);
      localHandlers.finish?.forEach((handler) => handler());
      // Trigger the same handlers again to ensure idempotency
      localHandlers.finish?.forEach((handler) => handler());
      localHandlers.error?.forEach((handler) => handler());
    };

    invoke(
      {
        method: "",
        baseUrl: "/api",
        route: { path: "/orders/:id" } as Request["route"],
      },
      201,
    );

    invoke(
      {
        method: "get",
        path: "/health",
      },
      404,
    );

    invoke(
      {
        method: "post",
        originalUrl: "/status?verbose=1",
      },
      0,
    );

    invoke(
      {
        method: "delete",
        originalUrl: "",
      },
      503,
    );

    expect(observeHttpRequest).toHaveBeenCalledTimes(4);
    expect(
      observeHttpRequest.mock.calls.map(([labels]) => (labels as { route: string }).route),
    ).toEqual(["/api/orders/:id", "/health", "/status", "unmatched"]);
    const [firstCall] = observeHttpRequest.mock.calls;
    expect(firstCall?.[0]).toEqual(
      expect.objectContaining({
        method: "UNKNOWN",
        status: "201",
      }),
    );
    const thirdCall = observeHttpRequest.mock.calls[2];
    expect(thirdCall?.[0]).toEqual(
      expect.objectContaining({
        status: "0",
      }),
    );
  });
});
