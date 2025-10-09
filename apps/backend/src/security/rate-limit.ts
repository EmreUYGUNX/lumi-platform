import { RateLimiterMemory } from "rate-limiter-flexible";

import type { ApplicationConfig } from "@lumi/types";

export interface RateLimiterAdapter {
  enabled: boolean;
  consume: (key: string) => Promise<void>;
  limiter?: RateLimiterMemory;
}

const createDisabledLimiter = (): RateLimiterAdapter => ({
  enabled: false,
  consume: async () => {
    /* noop */
  },
});

export const createRateLimiter = (
  config: ApplicationConfig["security"]["rateLimit"],
): RateLimiterAdapter => {
  if (!config.enabled) {
    return createDisabledLimiter();
  }

  if (config.strategy === "redis") {
    if (!config.redis?.url) {
      throw new Error("Redis rate limiter strategy requires RATE_LIMIT_REDIS_URL to be set");
    }

    // Redis support will be introduced alongside the Redis infrastructure in a later phase.
    return createDisabledLimiter();
  }

  const limiter = new RateLimiterMemory({
    points: config.points,
    duration: config.durationSeconds,
    blockDuration: config.blockDurationSeconds,
    keyPrefix: config.keyPrefix,
  });

  return {
    enabled: true,
    consume: async (key: string) => {
      await limiter.consume(key);
    },
    limiter,
  };
};
