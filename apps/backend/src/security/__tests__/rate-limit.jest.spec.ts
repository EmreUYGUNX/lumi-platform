import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import * as redis from "redis";

import { createRateLimiter } from "../rate-limit.js";
import { createSecurityConfig } from "./fixtures.js";

const redisConnectMock = jest.fn(async () => {});
const redisOnMock = jest.fn();
let createClientSpy: jest.SpiedFunction<typeof redis.createClient>;

describe("rate limiter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createClientSpy = jest.spyOn(redis, "createClient") as jest.SpiedFunction<
      typeof redis.createClient
    >;
    createClientSpy.mockImplementation(
      () =>
        ({
          on: redisOnMock,
          connect: redisConnectMock,
        }) as unknown as ReturnType<typeof redis.createClient>,
    );
  });

  afterEach(() => {
    createClientSpy.mockRestore();
  });

  it("supports memory-backed limiting", async () => {
    const config = createSecurityConfig();
    const limiter = createRateLimiter(config.rateLimit);

    await limiter.consume("user-1");
    await limiter.consume("user-1");
    await expect(limiter.consume("user-1")).rejects.toMatchObject({
      msBeforeNext: expect.any(Number),
    });
  });

  it("returns a noop limiter when disabled", async () => {
    const config = createSecurityConfig();
    const limiter = createRateLimiter({ ...config.rateLimit, enabled: false });
    await expect(limiter.consume("user-1")).resolves.toBeUndefined();
  });

  it("throws when redis strategy is misconfigured", () => {
    const config = createSecurityConfig();
    expect(() =>
      createRateLimiter({ ...config.rateLimit, strategy: "redis", redis: undefined }),
    ).toThrow("Redis rate limiter strategy requires RATE_LIMIT_REDIS_URL to be set");
  });

  it("falls back to memory limiting when Redis client creation fails", async () => {
    const config = createSecurityConfig();
    createClientSpy.mockImplementationOnce(() => {
      throw new Error("redis offline");
    });

    const limiter = createRateLimiter({
      ...config.rateLimit,
      strategy: "redis",
      redis: { url: "redis://localhost:6379/0" },
    });

    await limiter.consume("user-1");
    await limiter.consume("user-1");
    await expect(limiter.consume("user-1")).rejects.toMatchObject({
      msBeforeNext: expect.any(Number),
    });
  });
});
