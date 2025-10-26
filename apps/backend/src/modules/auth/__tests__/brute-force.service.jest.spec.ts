import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { type RateLimiterRedis, RateLimiterRes } from "rate-limiter-flexible";
import type { Logger as WinstonLogger } from "winston";

import * as configModule from "@/config/index.js";
import { createTestConfig } from "@/testing/config.js";

import {
  type BruteForceProtectionOptions,
  BruteForceProtectionService,
} from "../brute-force.service.js";

const createClientMock = jest.fn(() => ({
  on: jest.fn(),
  connect: jest.fn(async () => {}),
  sendCommand: jest.fn(async () => "OK"),
  quit: jest.fn(async () => {}),
  duplicate: jest.fn(),
  isOpen: true,
}));

jest.mock("redis", () => ({
  createClient: () => createClientMock(),
}));

const createLogger = () => {
  const stub = {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  return { stub, logger: stub as unknown as WinstonLogger };
};

const buildService = (
  configOverrides: Parameters<typeof createTestConfig>[0] = {},
  serviceOverrides: Partial<BruteForceProtectionOptions> = {},
) => {
  const config = createTestConfig(configOverrides);
  const { stub, logger } = createLogger();
  const service = new BruteForceProtectionService({
    config,
    logger,
    ...serviceOverrides,
  });

  return { service, logger: stub, config };
};

describe("BruteForceProtectionService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("applies progressive delays based on prior failures", async () => {
    const delays: number[] = [];
    const sleep = jest.fn(async (ms: number) => {
      delays.push(ms);
    });

    const { service } = buildService(
      {
        auth: {
          bruteForce: {
            progressiveDelays: {
              baseDelayMs: 100,
              stepDelayMs: 50,
              maxDelayMs: 300,
            },
          },
        },
      },
      { sleep },
    );

    const email = "test@example.com";

    await service.recordFailure(email);
    await service.applyDelay(email);
    expect(delays).toEqual([100]);

    await service.recordFailure(email);
    await service.applyDelay(email);
    expect(delays).toEqual([100, 150]);
  });

  it("caps progressive delay at configured maximum once attempts grow", async () => {
    const delays: number[] = [];
    const sleep = jest.fn(async (ms: number) => {
      delays.push(ms);
    });

    const { service } = buildService(
      {
        auth: {
          bruteForce: {
            progressiveDelays: {
              baseDelayMs: 200,
              stepDelayMs: 150,
              maxDelayMs: 400,
            },
          },
        },
      },
      { sleep },
    );

    const email = "cap@example.com";

    await service.recordFailure(email);
    await service.applyDelay(email);

    await service.recordFailure(email);
    await service.applyDelay(email);

    await service.recordFailure(email);
    await service.applyDelay(email);

    expect(delays).toEqual([200, 350, 400]);
  });

  it("tracks failure counts and signals captcha requirement", async () => {
    const { service, logger } = buildService({
      auth: {
        bruteForce: {
          captchaThreshold: 2,
        },
      },
    });

    const email = "user@example.com";

    const first = await service.recordFailure(email);
    expect(first).toEqual({ attempts: 1, captchaRequired: false });

    const second = await service.recordFailure(email);
    expect(second).toEqual({ attempts: 2, captchaRequired: true });
    expect(logger.warn).toHaveBeenNthCalledWith(
      2,
      "Login failure tracked for brute force protection",
      expect.objectContaining({
        email,
        attempts: 2,
        captchaRequired: true,
      }),
    );
  });

  it("resets counters after successful login", async () => {
    const delays: number[] = [];
    const sleep = jest.fn(async (ms: number) => {
      delays.push(ms);
    });
    const { service } = buildService({}, { sleep });

    const email = "reset@example.com";

    await service.recordFailure(email);
    await service.reset(email);
    await service.applyDelay(email);

    expect(delays).toEqual([]);
  });

  it("skips progressive delay when no failures are recorded", async () => {
    const sleep = jest.fn(async () => {});
    const { service } = buildService({}, { sleep });

    await service.applyDelay("fresh@example.com");

    expect(sleep).not.toHaveBeenCalled();
  });

  it("no-ops when brute force protection is disabled", async () => {
    const sleep = jest.fn(async () => {});
    const { service } = buildService(
      {
        auth: {
          bruteForce: {
            enabled: false,
          },
        },
      },
      { sleep },
    );

    const email = "disabled@example.com";

    const record = await service.recordFailure(email);
    expect(record).toEqual({ attempts: 0, captchaRequired: false });

    await service.applyDelay(email);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("uses global configuration when no overrides are supplied", () => {
    const getConfigSpy = jest.spyOn(configModule, "getConfig");

    const service = new BruteForceProtectionService();

    expect(service).toBeInstanceOf(BruteForceProtectionService);
    expect(getConfigSpy).toHaveBeenCalled();

    getConfigSpy.mockRestore();
  });

  it("falls back to memory limiting when redis consume throws unexpected errors", async () => {
    const { service } = buildService({
      security: {
        rateLimit: {
          strategy: "redis",
          redis: { url: "redis://localhost:6379/0" },
        },
      },
    });

    const { redisLimiter } = service as unknown as { redisLimiter?: RateLimiterRedis };
    expect(redisLimiter).toBeDefined();

    const consumeSpy = jest
      .spyOn(redisLimiter as RateLimiterRedis, "consume")
      .mockRejectedValueOnce(new Error("redis down"));

    const result = await service.recordFailure("redis-fallback@example.com");

    expect(result).toEqual({ attempts: 1, captchaRequired: false });
    expect(consumeSpy).toHaveBeenCalled();

    consumeSpy.mockRestore();
  });

  it("propagates rate limiter responses when redis limiter is exhausted", async () => {
    const { service } = buildService({
      security: {
        rateLimit: {
          strategy: "redis",
          redis: { url: "redis://localhost:6379/1" },
        },
      },
    });

    const { redisLimiter } = service as unknown as { redisLimiter?: RateLimiterRedis };
    expect(redisLimiter).toBeDefined();

    const limiterExceeded = new RateLimiterRes(1000, 0);

    const consumeSpy = jest
      .spyOn(redisLimiter as RateLimiterRedis, "consume")
      .mockRejectedValueOnce(limiterExceeded);

    await expect(service.recordFailure("limit-hit@example.com")).rejects.toBe(limiterExceeded);

    consumeSpy.mockRestore();
  });

  it("logs redis client initialisation failures and continues with memory limiter", () => {
    createClientMock.mockImplementationOnce(() => {
      throw new Error("redis unavailable");
    });

    const { service } = buildService({
      security: {
        rateLimit: {
          strategy: "redis",
          redis: { url: "redis://localhost:6379/5" },
        },
      },
    });

    const internals = service as unknown as { redisLimiter?: unknown };

    expect(createClientMock).toHaveBeenCalled();
    expect(internals.redisLimiter).toBeUndefined();
  });

  it("logs redis connection failures without crashing", async () => {
    const { stub, logger } = createLogger();
    createClientMock.mockImplementationOnce(() => ({
      on: jest.fn(),
      connect: jest.fn(async () => {
        throw new Error("connect refused");
      }),
      sendCommand: jest.fn(async () => "OK"),
      quit: jest.fn(async () => {}),
      duplicate: jest.fn(),
      isOpen: true,
    }));

    const service = new BruteForceProtectionService({
      config: createTestConfig({
        security: {
          rateLimit: {
            strategy: "redis",
            redis: { url: "redis://localhost:6379/6" },
          },
        },
      }),
      logger,
    });

    expect(service).toBeInstanceOf(BruteForceProtectionService);

    await new Promise((resolve) => {
      setImmediate(resolve);
    });

    expect(stub.error).toHaveBeenCalledWith(
      "Failed to connect brute force Redis limiter",
      expect.objectContaining({ url: "redis://localhost:6379/6" }),
    );
  });

  it("skips reset operations when brute force protection is disabled", async () => {
    const { service } = buildService({
      auth: {
        bruteForce: {
          enabled: false,
        },
      },
    });

    const { memoryLimiter } = service as unknown as { memoryLimiter: { delete: jest.Mock } };
    memoryLimiter.delete = jest.fn();

    await service.reset("disabled@example.com");

    expect(memoryLimiter.delete).not.toHaveBeenCalled();
  });

  it("logs failures when brute force counters cannot be reset", async () => {
    const { service, logger } = buildService();
    const { memoryLimiter } = service as unknown as { memoryLimiter: { delete: jest.Mock } };

    memoryLimiter.delete = jest.fn(async () => {
      throw new Error("delete failed");
    });

    await service.reset("reset-fail@example.com");

    expect(logger.error).toHaveBeenCalledWith(
      "Failed to reset brute force counter",
      expect.objectContaining({
        email: "reset-fail@example.com",
        prefix: expect.any(String),
      }),
    );
  });
});
