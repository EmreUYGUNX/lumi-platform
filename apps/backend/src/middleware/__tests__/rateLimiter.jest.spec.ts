import { jest } from "@jest/globals";
import type { NextFunction, Request, Response } from "express";

import { createTestConfig } from "../../testing/config.js";

const warnMock = jest.fn();
const errorMock = jest.fn();

jest.mock("../../lib/logger.js", () => ({
  logger: {
    warn: warnMock,
    error: errorMock,
  },
}));

const rateLimitOptions: Record<string, unknown>[] = [];
const ipKeyGeneratorMock = jest.fn((value: string) => `ip:${value}`);

class MemoryStoreMock {}

const rateLimitMock = jest.fn((options: Record<string, unknown>) => {
  rateLimitOptions.push(options);
  return jest.fn((_req: Request, _res: Response, next: NextFunction) => next());
});

jest.mock("express-rate-limit", () => ({
  __esModule: true,
  default: rateLimitMock,
  MemoryStore: MemoryStoreMock,
  ipKeyGenerator: ipKeyGeneratorMock,
}));

const redisQuitMock = jest.fn(async () => {});
const redisConnectMock = jest.fn(async () => {});
const redisSendCommandMock = jest.fn(async () => [0, 0]);

const buildRedisClient = () => {
  const handlers = new Map<string, ((...args: unknown[]) => void)[]>();
  const client = {
    connect: redisConnectMock,
    on: (event: string, handler: (...args: unknown[]) => void) => {
      const listeners = handlers.get(event) ?? [];
      listeners.push(handler);
      handlers.set(event, listeners);
      return client;
    },
    getHandlers: () => handlers,
    isOpen: true,
    quit: redisQuitMock,
    sendCommand: redisSendCommandMock,
  };

  return client;
};

const createClientMock = jest.fn(() => buildRedisClient());

jest.mock("redis", () => ({ createClient: createClientMock }));

jest.mock("rate-limit-redis", () =>
  jest.fn().mockImplementation(() => ({
    increment: jest.fn(async () => ({ totalHits: 1, resetTime: new Date() })),
    decrement: jest.fn(async () => {}),
    resetKey: jest.fn(async () => {}),
    resetAll: jest.fn(async () => {}),
    shutdown: jest.fn(async () => {}),
  })),
);

const flushAsyncTasks = () =>
  new Promise<void>((resolve) => {
    setImmediate(resolve);
  });

describe("createRateLimiterBundle", () => {
  beforeEach(() => {
    warnMock.mockReset();
    errorMock.mockReset();
    rateLimitMock.mockClear();
    rateLimitOptions.length = 0;
    ipKeyGeneratorMock.mockReset();
    ipKeyGeneratorMock.mockImplementation((value: string) => `ip:${value}`);
    redisQuitMock.mockReset();
    redisQuitMock.mockImplementation(async () => {});
    redisConnectMock.mockReset();
    redisConnectMock.mockImplementation(async () => {});
    redisSendCommandMock.mockReset();
    redisSendCommandMock.mockImplementation(async () => [0, 0]);
    createClientMock.mockReset();
    createClientMock.mockImplementation(() => buildRedisClient());
  });

  afterEach(() => {
    jest.resetModules();
  });

  it("returns no-op middlewares when rate limiting is disabled", async () => {
    const { createRateLimiterBundle } = await import("../rateLimiter.js");
    const config = createTestConfig({
      security: {
        rateLimit: {
          enabled: false,
        },
      },
    }).security.rateLimit;

    const bundle = createRateLimiterBundle(config);
    const next = jest.fn();

    bundle.global({} as Request, {} as Response, next);
    bundle.auth({} as Request, {} as Response, next);
    await expect(bundle.cleanup()).resolves.toBeUndefined();

    expect(next).toHaveBeenCalledTimes(2);
    expect(rateLimitMock).not.toHaveBeenCalled();
  });

  it("initialises a Redis-backed limiter and tolerates cleanup errors", async () => {
    redisConnectMock.mockRejectedValueOnce(new Error("connect failed"));
    redisQuitMock.mockRejectedValueOnce(new Error("quit failed"));

    const { createRateLimiterBundle } = await import("../rateLimiter.js");
    const config = createTestConfig({
      security: {
        rateLimit: {
          enabled: true,
          strategy: "redis",
          redis: {
            url: "redis://localhost:6379/0",
          },
        },
      },
    }).security.rateLimit;

    const bundle = createRateLimiterBundle(config);

    await flushAsyncTasks();
    await bundle.cleanup();

    expect(createClientMock).toHaveBeenCalledTimes(2);
    expect(redisConnectMock).toHaveBeenCalled();
    expect(redisQuitMock).toHaveBeenCalled();
    expect(errorMock).toHaveBeenCalledWith(
      "Unable to establish Redis connection for rate limiting",
      expect.objectContaining({
        error: expect.any(Error),
        scope: expect.any(String),
        target: config.redis?.url,
      }),
    );
    expect(warnMock).toHaveBeenCalledWith(
      "Failed to shutdown rate limiter store",
      expect.objectContaining({ error: expect.any(Error) }),
    );
  });

  it("uses an in-memory store when configured for memory strategy", async () => {
    const { createRateLimiterBundle } = await import("../rateLimiter.js");
    const config = createTestConfig({
      security: {
        rateLimit: {
          enabled: true,
          strategy: "memory",
        },
      },
    }).security.rateLimit;

    createRateLimiterBundle(config);

    expect(createClientMock).not.toHaveBeenCalled();
    expect(rateLimitMock).toHaveBeenCalled();
    const [options] = rateLimitOptions;
    expect(options?.store).toBeInstanceOf(MemoryStoreMock);
  });

  it("derives key generators and handlers with contextual metadata", async () => {
    const { createRateLimiterBundle } = await import("../rateLimiter.js");
    const config = createTestConfig({
      security: {
        rateLimit: {
          enabled: true,
          keyPrefix: "backend",
          points: 5,
          durationSeconds: 30,
          blockDurationSeconds: 90,
          routes: {
            auth: {
              points: 3,
              durationSeconds: 10,
              blockDurationSeconds: 60,
            },
          },
        },
      },
    }).security.rateLimit;

    createRateLimiterBundle(config);

    const [globalOptions] = rateLimitOptions;
    if (!globalOptions) {
      throw new Error("Rate limiter options were not captured");
    }

    const handler = globalOptions.handler as (
      request: Request,
      response: Response,
      next: NextFunction,
      info: { statusCode: number },
    ) => void;
    const keyGenerator = globalOptions.keyGenerator as (request: Request) => string;

    const retryAfterSeconds = Math.max(config.durationSeconds, config.blockDurationSeconds);
    const request = { ip: "203.0.113.10", id: "req-123" } as unknown as Request;

    const baseResponse = {
      locals: {},
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    handler(request, baseResponse, jest.fn(), { statusCode: 429 });

    expect(baseResponse.setHeader).toHaveBeenCalledWith("Retry-After", retryAfterSeconds);
    expect(baseResponse.status).toHaveBeenCalledWith(429);
    expect(baseResponse.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many requests. Please try again later.",
        details: {
          retryAfterSeconds,
          scope: "global",
          requestId: request.id,
        },
      },
    });

    const responseWithRequestId = {
      locals: { requestId: "from-locals" },
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    handler(request, responseWithRequestId, jest.fn(), { statusCode: 429 });

    expect(responseWithRequestId.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many requests. Please try again later.",
        details: {
          retryAfterSeconds,
          scope: "global",
          requestId: "from-locals",
        },
      },
    });

    const generatedKey = keyGenerator({ ip: "203.0.113.10" } as unknown as Request);

    expect(ipKeyGeneratorMock).toHaveBeenCalledWith("203.0.113.10");
    expect(generatedKey).toBe("backend:global:ip:203.0.113.10");
  });

  it("logs Redis client errors emitted after initialisation", async () => {
    const { createRateLimiterBundle } = await import("../rateLimiter.js");
    const config = createTestConfig({
      security: {
        rateLimit: {
          enabled: true,
          strategy: "redis",
          redis: {
            url: "redis://localhost:6379/0",
          },
        },
      },
    }).security.rateLimit;

    createRateLimiterBundle(config);

    const firstClient = createClientMock.mock.results[0]?.value as
      | ReturnType<typeof buildRedisClient>
      | undefined;
    const handlers = firstClient?.getHandlers().get("error");
    const errorHandler = handlers?.[0];

    if (!errorHandler) {
      throw new Error("Redis error handler was not registered");
    }

    const emittedError = new Error("redis boom");
    errorHandler(emittedError);

    expect(errorMock).toHaveBeenCalledWith(
      "Redis rate limiter connection error",
      expect.objectContaining({
        error: emittedError,
        scope: expect.any(String),
        target: config.redis?.url,
      }),
    );
  });

  it("skips Redis shutdown when clients are already closed", async () => {
    createClientMock.mockImplementationOnce(() => {
      const client = buildRedisClient();
      client.isOpen = false;
      return client;
    });

    createClientMock.mockImplementationOnce(() => {
      const client = buildRedisClient();
      client.isOpen = false;
      return client;
    });

    const { createRateLimiterBundle } = await import("../rateLimiter.js");
    const config = createTestConfig({
      security: {
        rateLimit: {
          enabled: true,
          strategy: "redis",
          redis: {
            url: "redis://localhost:6379/0",
          },
        },
      },
    }).security.rateLimit;

    const bundle = createRateLimiterBundle(config);
    await bundle.cleanup();

    expect(redisQuitMock).not.toHaveBeenCalled();
    expect(warnMock).not.toHaveBeenCalled();
  });

  it("logs initialisation failures when Redis client creation throws", async () => {
    createClientMock.mockImplementationOnce(() => {
      throw new Error("missing redis");
    });

    const { createRateLimiterBundle } = await import("../rateLimiter.js");
    const config = createTestConfig({
      security: {
        rateLimit: {
          enabled: true,
          strategy: "redis",
          redis: {
            url: "redis://localhost:6379/0",
          },
        },
      },
    }).security.rateLimit;

    createRateLimiterBundle(config);

    expect(errorMock).toHaveBeenCalledWith(
      "Failed to initialise Redis rate limiter store",
      expect.objectContaining({
        error: expect.any(Error),
        scope: "global",
        target: config.redis?.url,
      }),
    );
  });
});
