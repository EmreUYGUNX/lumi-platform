import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import express, { type RequestHandler } from "express";

import { createApiClient } from "@lumi/testing";
import type { ApplicationConfig } from "@lumi/types";

import { responseFormatter } from "../response-formatter.js";

const createBaseConfig = (): ApplicationConfig =>
  ({
    app: {
      name: "Test",
      environment: "test",
      port: 0,
      apiBaseUrl: "http://localhost",
      frontendUrl: "http://localhost",
      logLevel: "info",
    },
    database: {
      url: "postgres://test",
    },
    cache: {
      redisUrl: "redis://localhost:6379",
    },
    storage: {
      bucket: "test",
    },
    security: {
      jwtSecret: "secret",
      cors: {
        enabled: true,
        allowedOrigins: ["*"],
        allowedMethods: ["GET"],
        allowedHeaders: ["Authorization"],
        exposedHeaders: [],
        allowCredentials: true,
        maxAgeSeconds: 600,
      },
      headers: {
        enabled: true,
        contentSecurityPolicy: "",
        referrerPolicy: "no-referrer",
        frameGuard: "DENY",
        permissionsPolicy: "",
        strictTransportSecurity: {
          maxAgeSeconds: 1,
          includeSubDomains: false,
          preload: false,
        },
        expectCt: {
          enforce: false,
          maxAgeSeconds: 0,
        },
        crossOriginEmbedderPolicy: "require-corp",
        crossOriginOpenerPolicy: "same-origin",
        crossOriginResourcePolicy: "same-origin",
        xContentTypeOptions: "nosniff",
      },
      rateLimit: {
        enabled: true,
        keyPrefix: "test",
        points: 2,
        durationSeconds: 60,
        blockDurationSeconds: 300,
        strategy: "memory",
      },
      validation: {
        strict: true,
        sanitize: true,
        stripUnknown: true,
        maxBodySizeKb: 512,
      },
    },
    observability: {
      sentryDsn: undefined,
      logs: {
        directory: "logs",
        rotation: {
          maxFiles: "7d",
          maxSize: "10m",
          zippedArchive: true,
        },
        consoleEnabled: true,
      },
      metrics: {
        enabled: false,
        endpoint: "/metrics",
        collectDefaultMetrics: false,
        defaultMetricsInterval: 10,
      },
      alerting: {
        enabled: false,
        severityThreshold: "error",
      },
      health: {
        uptimeGracePeriodSeconds: 0,
      },
    },
    featureFlags: {},
    runtime: {
      ci: false,
    },
  }) as unknown as ApplicationConfig;

const globalConfigKey = Symbol.for("__rate_limit_mock_config");
const globalStore = globalThis as Record<symbol, unknown>;

if (!globalStore[globalConfigKey]) {
  globalStore[globalConfigKey] = createBaseConfig();
}

function getMockConfig(): ApplicationConfig {
  return globalStore[globalConfigKey] as ApplicationConfig;
}

function setMockConfig(next: ApplicationConfig): void {
  globalStore[globalConfigKey] = next;
}

const respondOk: RequestHandler = (_req, res) => {
  res.json({ ok: true });
};

const noop = () => {};

jest.mock("../../config/index.js", () => ({
  __esModule: true,
  getConfig: jest.fn(() => getMockConfig()),
  onConfigChange: jest.fn(() => noop),
}));

const resetRateLimitConfig = () => {
  const mockConfig = getMockConfig();
  mockConfig.security.rateLimit.enabled = true;
  mockConfig.security.rateLimit.points = 2;
  mockConfig.security.rateLimit.durationSeconds = 60;
  mockConfig.security.rateLimit.strategy = "memory";
  setMockConfig(mockConfig);
};

describe("rate limiter middleware", () => {
  beforeEach(() => {
    resetRateLimitConfig();
  });

  it("limits repeated requests exceeding the configured threshold", async () => {
    const { createRateLimiter } = await import("../rate-limiter.js");
    const app = express();
    app.use(responseFormatter);
    app.use(createRateLimiter({ identifier: "test" }));
    app.get("/resource", respondOk);

    const agent = createApiClient(app);
    await agent.get("/resource").expect(200);
    await agent.get("/resource").expect(200);
    const limited = await agent.get("/resource").expect(429);

    expect(limited.body.success).toBe(false);
    expect(limited.body.error.code).toBe("RATE_LIMITED");
    expect(limited.headers).toHaveProperty("x-ratelimit-limit");
  });

  it("allows internal requests to bypass rate limiting when flagged", async () => {
    const { createRateLimiter } = await import("../rate-limiter.js");
    const app = express();
    app.use(responseFormatter);
    app.use(createRateLimiter({ identifier: "test" }));
    app.get("/resource", respondOk);

    const agent = createApiClient(app);
    await agent.get("/resource").set("X-Internal-Service", "internal").expect(200);
    await agent.get("/resource").set("X-Internal-Service", "internal").expect(200);
    const third = await agent.get("/resource").set("X-Internal-Service", "internal").expect(200);
    expect(third.body.success).toBe(true);
  });

  it("does not enforce limits when disabled", async () => {
    const mockConfig = getMockConfig();
    mockConfig.security.rateLimit.enabled = false;
    setMockConfig(mockConfig);

    const { createRateLimiter } = await import("../rate-limiter.js");

    const app = express();
    app.use(responseFormatter);
    app.use(createRateLimiter());
    app.get("/resource", respondOk);

    const agent = createApiClient(app);
    await agent.get("/resource").expect(200);
    await agent.get("/resource").expect(200);
    const third = await agent.get("/resource").expect(200);
    expect(third.body.success).toBe(true);
  });

  it("falls back to socket address and request metadata when ip or response helpers are unavailable", async () => {
    const { createRateLimiter } = await import("../rate-limiter.js");
    const app = express();
    app.use(responseFormatter);
    app.use((req, res, next) => {
      Object.defineProperty(req, "ip", {
        configurable: true,
        value: undefined,
        writable: true,
      });
      Object.defineProperty(req.socket, "remoteAddress", {
        configurable: true,
        value: "203.0.113.99",
        writable: true,
      });
      req.requestId = "req-fallback";
      res.requestId = undefined as unknown as string;
      // remove helper to test fallback path
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete (res as unknown as Record<string, unknown>).error;
      next();
    });
    app.use(createRateLimiter({ identifier: "socket-test", max: 1, windowSeconds: 60 }));
    app.get("/resource", respondOk);

    const agent = createApiClient(app);
    await agent.get("/resource").expect(200);
    const limited = await agent.get("/resource").expect(429);

    expect(limited.body.meta.requestId).toBe("req-fallback");
    expect(limited.body.error.code).toBe("RATE_LIMITED");
  });

  it("handles requests lacking addressing metadata", async () => {
    const { createRateLimiter } = await import("../rate-limiter.js");
    const app = express();
    app.use(responseFormatter);
    app.use((req, res, next) => {
      Object.defineProperty(req, "ip", {
        configurable: true,
        value: undefined,
        writable: true,
      });
      Object.defineProperty(req.socket, "remoteAddress", {
        configurable: true,
        value: undefined,
        writable: true,
      });
      req.requestId = "req-empty";
      res.requestId = undefined as unknown as string;
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete (res as unknown as Record<string, unknown>).error;
      next();
    });
    app.use(createRateLimiter({ identifier: "empty-socket", max: 1, windowSeconds: 60 }));
    app.get("/resource", respondOk);

    const agent = createApiClient(app);
    await agent.get("/resource").expect(200);
    const limited = await agent.get("/resource").expect(429);

    expect(limited.body.meta.requestId).toBe("req-empty");
    expect(limited.body.error.code).toBe("RATE_LIMITED");
  });

  it("does not bypass limits when internal bypass is disabled", async () => {
    const { createRateLimiter } = await import("../rate-limiter.js");
    const app = express();
    app.use(responseFormatter);
    app.use(
      createRateLimiter({
        identifier: "no-bypass",
        allowInternalBypass: false,
        max: 2,
        windowSeconds: 60,
      }),
    );
    app.get("/resource", respondOk);

    const agent = createApiClient(app);
    await agent.get("/resource").set("X-Internal-Service", "internal").expect(200);
    await agent.get("/resource").set("X-Internal-Service", "internal").expect(200);
    const limited = await agent.get("/resource").set("X-Internal-Service", "internal").expect(429);

    expect(limited.body.error.code).toBe("RATE_LIMITED");
  });

  it("falls back to an in-memory store when Redis client creation fails", async () => {
    const config = getMockConfig();
    config.security.rateLimit.strategy = "redis";
    config.cache.redisUrl = "redis://localhost:6380/0";
    setMockConfig(config);

    await jest.isolateModulesAsync(async () => {
      jest.doMock("redis", () => ({
        __esModule: true,
        createClient: jest.fn(() => {
          throw new Error("redis unavailable");
        }),
      }));

      const { createRateLimiter } = await import("../rate-limiter.js");

      const app = express();
      app.use(responseFormatter);
      app.use(createRateLimiter({ identifier: "redis-fallback", max: 1, windowSeconds: 60 }));
      app.get("/resource", respondOk);

      const agent = createApiClient(app);
      await agent.get("/resource").expect(200);
      const limited = await agent.get("/resource").expect(429);

      expect(limited.body.error.code).toBe("RATE_LIMITED");
    });

    jest.resetModules();
    resetRateLimitConfig();
  });
});
