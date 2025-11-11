// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, describe, expect, it, jest } from "@jest/globals";
import request from "supertest";
import Transport from "winston-transport";

import { resetEnvironmentCache } from "../../config/env.js";
import { withTemporaryEnvironment } from "../../config/testing.js";
import { registerLogTransport, unregisterLogTransport } from "../../lib/logger.js";
import { testingHarness as apiRoutesTesting } from "../index.js";

const BASE_ENV = {
  NODE_ENV: "test",
  APP_NAME: "ApiRouterTest",
  APP_PORT: "4800",
  API_BASE_URL: "http://localhost:4800",
  FRONTEND_URL: "http://localhost:3800",
  DATABASE_URL: "postgresql://localhost:59997/test",
  REDIS_URL: "redis://localhost:59996/0",
  STORAGE_BUCKET: "api-router-bucket",
  LOG_LEVEL: "warn",
  JWT_SECRET: "12345678901234567890123456789012",
  METRICS_ENABLED: "false",
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

class MemoryTransport extends Transport {
  public readonly events: Record<string, unknown>[] = [];

  constructor(level = "warn") {
    super({ level });
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  override log(info: unknown, callback: () => void): void {
    this.events.push(info as Record<string, unknown>);
    callback();
  }
}

describe("API router versioning", () => {
  it("serves v1 routes under the versioned prefix without deprecation headers", async () => {
    const transport = new MemoryTransport("warn");
    registerLogTransport("api-router-version-test", transport);

    try {
      await withTemporaryEnvironment(BASE_ENV, async () => {
        const { createApp } = await import("../../app.js");
        const app = createApp();

        const response = await request(app).get("/api/v1/health/live").expect(200);

        expect(response.headers["x-api-version"]).toBe("v1");
        expect(response.headers.deprecation).toBeUndefined();
        expect(response.headers.warning).toBeUndefined();
        expect(response.body.success).toBe(true);
        expect(response.body.meta?.check).toBe("liveness");
      });

      const warnEvent = transport.events.find(
        (event) => event.level === "warn" && event.message === "Deprecated API version used",
      );
      expect(warnEvent).toBeUndefined();
    } finally {
      unregisterLogTransport("api-router-version-test");
    }
  });

  it("exposes legacy `/api` routes with deprecation signalling and documentation link", async () => {
    const transport = new MemoryTransport("warn");
    registerLogTransport("api-router-test", transport);

    try {
      await withTemporaryEnvironment(BASE_ENV, async () => {
        const { createApp } = await import("../../app.js");
        const app = createApp();

        const response = await request(app).get("/api/health/live").expect(200);

        expect(response.headers["x-api-version"]).toBe("v0");
        expect(response.headers.deprecation).toBe("true");
        expect(response.headers.warning).toContain("deprecated");
        expect(response.headers.link).toContain("/docs/api");
        expect(response.headers.sunset).toBeDefined();
        expect(response.body.success).toBe(true);
        expect(response.body.meta?.check).toBe("liveness");
      });

      const warnEvent = transport.events.find(
        (event) => event.level === "warn" && event.message === "Deprecated API version used",
      );
      expect(warnEvent).toBeDefined();
    } finally {
      unregisterLogTransport("api-router-test");
    }
  });

  it("skips deprecation signalling for other version namespaces", async () => {
    const transport = new MemoryTransport("warn");
    registerLogTransport("api-router-future-test", transport);

    try {
      await withTemporaryEnvironment(BASE_ENV, async () => {
        const { createApp } = await import("../../app.js");
        const app = createApp();

        await request(app).get("/api/v2/unknown").expect(404);
      });

      const warnEvent = transport.events.find(
        (event) => event.level === "warn" && event.message === "Deprecated API version used",
      );
      expect(warnEvent).toBeUndefined();
    } finally {
      unregisterLogTransport("api-router-future-test");
    }
  });

  it("short-circuits the deprecation middleware when the request is already versioned", () => {
    const middleware = apiRoutesTesting.createDeprecationMiddleware("v0", {});
    const setHeader = jest.fn();
    const on = jest.fn();
    const next = jest.fn();

    const req = {
      path: "/v3/catalog",
      method: "GET",
      originalUrl: "/api/v3/catalog",
    } as unknown as Parameters<typeof middleware>[0];

    const res = {
      setHeader,
      on,
    } as unknown as Parameters<typeof middleware>[1];

    middleware(req, res, next);

    expect(setHeader).not.toHaveBeenCalled();
    expect(on).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("normalises versioned route registration", () => {
    const registerRoute = jest.fn();
    const registrar = apiRoutesTesting.createVersionRegistrar("v9", registerRoute);

    registrar?.("post", "/orders");

    expect(registerRoute).toHaveBeenCalledWith("post", "/v9/orders");
  });

  it("returns a noop registrar when no registry is provided", () => {
    const registrar = apiRoutesTesting.createVersionRegistrar("v10");

    expect(registrar?.("get", "/health")).toBeUndefined();
  });
});

afterEach(() => {
  resetEnvironmentCache();
});
