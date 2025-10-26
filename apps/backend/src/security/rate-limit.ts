import {
  type RateLimiterAbstract,
  RateLimiterMemory,
  RateLimiterRedis,
  RateLimiterRes,
} from "rate-limiter-flexible";
import { createClient } from "redis";

import { logger } from "@/lib/logger.js";
import type { ApplicationConfig } from "@lumi/types";

export interface RateLimiterAdapter {
  enabled: boolean;
  consume: (key: string) => Promise<void>;
  limiter?: RateLimiterAbstract;
}

const createDisabledLimiter = (): RateLimiterAdapter => ({
  enabled: false,
  consume: async () => {
    /* noop */
  },
});

const createMemoryLimiter = (config: ApplicationConfig["security"]["rateLimit"]) =>
  new RateLimiterMemory({
    points: config.points,
    duration: config.durationSeconds,
    blockDuration: config.blockDurationSeconds,
    keyPrefix: config.keyPrefix,
  });

const initialiseRedisLimiter = (
  config: ApplicationConfig["security"]["rateLimit"],
): RateLimiterRedis | undefined => {
  if (config.strategy !== "redis") {
    return undefined;
  }

  if (!config.redis?.url) {
    throw new Error("Redis rate limiter strategy requires RATE_LIMIT_REDIS_URL to be set");
  }

  try {
    const client = createClient({ url: config.redis.url });
    client.on("error", (error) => {
      logger.error("Security rate limiter Redis error", {
        error,
        prefix: config.keyPrefix,
      });
    });

    const limiter = new RateLimiterRedis({
      storeClient: client,
      keyPrefix: config.keyPrefix,
      points: config.points,
      duration: config.durationSeconds,
      blockDuration: config.blockDurationSeconds,
    });

    client.connect().catch((error) =>
      logger.error("Failed to connect security rate limiter Redis client", {
        error,
        prefix: config.keyPrefix,
        url: config.redis?.url,
      }),
    );

    return limiter;
  } catch (error) {
    logger.error("Unable to initialise Redis-backed security rate limiter", {
      error,
      prefix: config.keyPrefix,
      url: config.redis?.url,
    });

    return undefined;
  }
};

const consumeLimiter = async (
  key: string,
  memoryLimiter: RateLimiterMemory,
  redisLimiter: RateLimiterRedis | undefined,
  config: ApplicationConfig["security"]["rateLimit"],
): Promise<void> => {
  if (!redisLimiter) {
    await memoryLimiter.consume(key);
    return;
  }

  try {
    await redisLimiter.consume(key);
  } catch (error) {
    if (error instanceof RateLimiterRes) {
      throw error;
    }

    logger.error("Redis security rate limiter failure; falling back to memory", {
      error,
      prefix: config.keyPrefix,
      key,
    });

    await memoryLimiter.consume(key);
  }
};

export const createRateLimiter = (
  config: ApplicationConfig["security"]["rateLimit"],
): RateLimiterAdapter => {
  if (!config.enabled) {
    return createDisabledLimiter();
  }

  const memoryLimiter = createMemoryLimiter(config);
  const redisLimiter = initialiseRedisLimiter(config);

  return {
    enabled: true,
    limiter: (redisLimiter ?? memoryLimiter) as RateLimiterAbstract,
    consume: async (key: string) => {
      await consumeLimiter(key, memoryLimiter, redisLimiter, config);
    },
  };
};
