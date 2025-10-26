import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { NextFunction, Request, Response } from "express";
import { RateLimiterMemory } from "rate-limiter-flexible";

import { createAuthRateLimiter } from "../authRateLimiter.js";
import type { AuthRateLimiterOptions } from "../authRateLimiter.js";

const redisConnectMock = jest.fn(async () => {});
const redisOnMock = jest.fn();
const createClientMock = jest.fn(() => ({
  on: redisOnMock,
  connect: redisConnectMock,
}));

jest.mock("redis", () => ({
  createClient: () => createClientMock(),
}));

jest.mock("@/lib/logger.js", () => ({
  createChildLogger: jest.fn(() => ({
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

const createRequest = (overrides: Partial<Request> = {}): Request =>
  ({
    headers: {},
    ip: "203.0.113.100",
    ...overrides,
  }) as unknown as Request;

const createResponse = () => {
  const res = {} as Response;
  const status = jest.fn(() => res);
  const json = jest.fn(() => res);
  const setHeader = jest.fn();

  res.status = status as unknown as Response["status"];
  res.json = json as unknown as Response["json"];
  res.setHeader = setHeader as unknown as Response["setHeader"];

  return { res, status, json, setHeader };
};

const createNext = () => {
  const mock = jest.fn();
  return {
    handler: mock as unknown as NextFunction,
    mock,
  };
};

const flushAsync = () =>
  new Promise<void>((resolve) => {
    setImmediate(resolve);
  });

type LimitExceededHook = NonNullable<AuthRateLimiterOptions["onLimitExceeded"]>;

describe("createAuthRateLimiter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    redisConnectMock.mockImplementation(async () => {});
    redisOnMock.mockImplementation(() => {});
    createClientMock.mockImplementation(() => ({
      on: redisOnMock,
      connect: redisConnectMock,
    }));
  });

  it("allows requests when under the configured rate limit", async () => {
    const limiter = createAuthRateLimiter({
      keyPrefix: "test-allow",
      points: 2,
      durationSeconds: 60,
      strategy: "memory",
    });
    const req = createRequest();
    const { res } = createResponse();
    const next = createNext();

    await limiter(req, res, next.handler);

    expect(next.mock).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("rejects requests exceeding the limit, setting retry headers and emitting payload", async () => {
    const onLimitExceeded = jest.fn(async () => {}) as jest.MockedFunction<LimitExceededHook>;
    const limiter = createAuthRateLimiter({
      keyPrefix: "test-block",
      points: 1,
      durationSeconds: 60,
      onLimitExceeded,
      strategy: "memory",
    });
    const req = createRequest({
      headers: { "x-forwarded-for": "198.51.100.10, 203.0.113.50" },
    });
    const next = createNext();

    await limiter(req, createResponse().res, next.handler);

    const limited = createResponse();
    await limiter(req, limited.res, next.handler);
    await flushAsync();

    expect(next.mock).toHaveBeenCalledTimes(1);
    expect(limited.status).toHaveBeenCalledWith(429);
    expect(limited.setHeader).toHaveBeenCalledWith("Retry-After", expect.any(Number));
    expect(limited.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: "RATE_LIMITED",
          message: "Too many requests. Please try again later.",
          details: expect.objectContaining({
            prefix: "test-block",
            key: "198.51.100.10",
            retryAfterSeconds: expect.any(Number),
          }),
        }),
      }),
    );
    expect(onLimitExceeded).toHaveBeenCalledTimes(1);
    expect(onLimitExceeded.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        key: "198.51.100.10",
      }),
    );
  });

  it("falls back to request-derived keys and propagates unexpected errors", async () => {
    const consumeSpy = jest.spyOn(RateLimiterMemory.prototype, "consume");
    consumeSpy.mockImplementationOnce(() => {
      throw new Error("limiter failure");
    });

    const limiter = createAuthRateLimiter({
      keyPrefix: "test-error",
      points: 1,
      durationSeconds: 10,
      keyGenerator: (): string | undefined => undefined,
      strategy: "memory",
    });

    const req = createRequest({ ip: "192.0.2.55" });
    const { res } = createResponse();
    const next = createNext();

    await limiter(req, res, next.handler);

    expect(next.mock).toHaveBeenCalledTimes(1);
    expect(next.mock.mock.calls[0]?.[0]).toBeInstanceOf(Error);
    expect(consumeSpy.mock.calls[0]?.[0]).toBe("192.0.2.55");
    consumeSpy.mockRestore();
  });

  it("bypasses limiting for whitelisted IPs", async () => {
    const limiter = createAuthRateLimiter({
      keyPrefix: "test-whitelist",
      points: 1,
      durationSeconds: 60,
      ipWhitelist: ["203.0.113.100"],
      strategy: "memory",
    });

    const req = createRequest();
    const { res } = createResponse();
    const next = createNext();

    for (let index = 0; index < 5; index += 1) {
      // eslint-disable-next-line no-await-in-loop -- sequential requests emulate real traffic ordering.
      await limiter(req, res, next.handler);
    }

    expect(next.mock).toHaveBeenCalledTimes(5);
  });

  it("falls back to in-memory limiting when Redis client creation throws", async () => {
    createClientMock.mockImplementationOnce(() => {
      throw new Error("redis unavailable");
    });

    const limiter = createAuthRateLimiter({
      keyPrefix: "test-redis-fallback",
      points: 1,
      durationSeconds: 60,
      strategy: "redis",
      redisUrl: "redis://localhost:6379/0",
    });

    const req = createRequest();
    const { res } = createResponse();
    const next = createNext();

    await limiter(req, res, next.handler);
    await limiter(req, res, next.handler);

    const limited = createResponse();
    await limiter(req, limited.res, next.handler);
    await flushAsync();

    expect(limited.status).toHaveBeenCalledWith(429);
  });

  it("uses redis-backed storage when available", async () => {
    const connectSpy = jest.fn(async () => {});
    createClientMock.mockImplementationOnce(() => ({
      on: redisOnMock,
      connect: connectSpy,
    }));

    const limiter = createAuthRateLimiter({
      keyPrefix: "test-redis-success",
      points: 1,
      durationSeconds: 60,
      strategy: "redis",
      redisUrl: "redis://localhost:6379/2",
    });

    const req = createRequest();
    const { res } = createResponse();
    const next = createNext();

    await limiter(req, res, next.handler);

    expect(connectSpy).toHaveBeenCalled();
    expect(next.mock).toHaveBeenCalledTimes(1);
  });
});
