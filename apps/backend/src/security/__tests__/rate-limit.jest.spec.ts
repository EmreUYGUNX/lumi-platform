import { describe, expect, it } from "@jest/globals";

import { createRateLimiter } from "../rate-limit.js";
import { createSecurityConfig } from "./fixtures.js";

describe("rate limiter", () => {
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
});
