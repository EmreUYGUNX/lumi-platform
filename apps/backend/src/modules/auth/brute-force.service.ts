import {
  type RateLimiterAbstract,
  RateLimiterMemory,
  RateLimiterRedis,
  RateLimiterRes,
} from "rate-limiter-flexible";
import { createClient } from "redis";

import { getConfig } from "@/config/index.js";
import { createChildLogger } from "@/lib/logger.js";
import type { ApplicationConfig, RateLimitStrategy } from "@lumi/types";

const BRUTE_FORCE_LOGGER = "auth:brute-force";
const DEFAULT_MAX_POINTS = 1000;

const normaliseEmail = (email: string): string => email.trim().toLowerCase();

const sleep = async (delayMs: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });

type SleepFn = (delayMs: number) => Promise<void>;

export interface BruteForceProtectionOptions {
  config?: ApplicationConfig;
  logger?: ReturnType<typeof createChildLogger>;
  sleep?: SleepFn;
}

export interface BruteForceRecordResult {
  attempts: number;
  captchaRequired: boolean;
}

export class BruteForceProtectionService {
  private readonly config: ApplicationConfig["auth"]["bruteForce"];

  private readonly strategy: RateLimitStrategy;

  private readonly redisUrl?: string;

  private readonly keyPrefix: string;

  private readonly logger: ReturnType<typeof createChildLogger>;

  private readonly memoryLimiter: RateLimiterMemory;

  private readonly redisLimiter?: RateLimiterRedis;

  private readonly enabled: boolean;

  private readonly sleep: SleepFn;

  constructor(options: BruteForceProtectionOptions = {}) {
    const appConfig = options.config ?? getConfig();

    this.config = appConfig.auth.bruteForce;
    this.enabled = this.config.enabled;
    this.strategy = appConfig.security.rateLimit.strategy;
    this.redisUrl = appConfig.security.rateLimit.redis?.url;
    this.keyPrefix = `${appConfig.security.rateLimit.keyPrefix}:auth:brute-force`;
    this.logger = options.logger ?? createChildLogger(BRUTE_FORCE_LOGGER);

    this.memoryLimiter = new RateLimiterMemory({
      keyPrefix: this.keyPrefix,
      points: DEFAULT_MAX_POINTS,
      duration: this.config.windowSeconds,
    });
    this.sleep = options.sleep ?? sleep;

    if (this.enabled && this.strategy === "redis" && this.redisUrl) {
      try {
        const client = createClient({ url: this.redisUrl });
        client.on("error", (error) => {
          this.logger.error("Brute force Redis limiter error", {
            error,
            prefix: this.keyPrefix,
          });
        });

        this.redisLimiter = new RateLimiterRedis({
          storeClient: client,
          keyPrefix: this.keyPrefix,
          points: DEFAULT_MAX_POINTS,
          duration: this.config.windowSeconds,
        });

        client.connect().catch((error) =>
          this.logger.error("Failed to connect brute force Redis limiter", {
            error,
            prefix: this.keyPrefix,
            url: this.redisUrl,
          }),
        );
      } catch (error) {
        this.logger.error("Unable to initialise Redis brute force limiter; using memory fallback", {
          error,
          prefix: this.keyPrefix,
          url: this.redisUrl,
        });
      }
    }
  }

  private get limiter(): RateLimiterAbstract {
    return this.redisLimiter ?? this.memoryLimiter;
  }

  private async consumeWithFallback(key: string): Promise<RateLimiterRes> {
    if (!this.redisLimiter) {
      return this.memoryLimiter.consume(key);
    }

    try {
      return await this.redisLimiter.consume(key);
    } catch (error) {
      if (error instanceof RateLimiterRes) {
        throw error;
      }

      this.logger.error("Redis brute force limiter failure; falling back to memory", {
        error,
        prefix: this.keyPrefix,
        key,
      });

      return this.memoryLimiter.consume(key);
    }
  }

  private async getAttempts(key: string): Promise<number> {
    const current = await this.limiter.get(key);
    return current?.consumedPoints ?? 0;
  }

  private computeDelayMs(attempts: number): number {
    if (attempts <= 0) {
      return 0;
    }

    const { baseDelayMs, stepDelayMs, maxDelayMs } = this.config.progressiveDelays;
    const delay = baseDelayMs + stepDelayMs * (attempts - 1);
    return Math.min(maxDelayMs, delay);
  }

  private buildKey(email: string): string {
    return `${this.keyPrefix}:${normaliseEmail(email)}`;
  }

  async applyDelay(email: string): Promise<void> {
    if (!this.enabled) {
      return;
    }

    const key = this.buildKey(email);
    const attempts = await this.getAttempts(key);
    const delayMs = this.computeDelayMs(attempts);

    if (delayMs <= 0) {
      return;
    }

    this.logger.debug?.("Applying progressive login delay", {
      email: normaliseEmail(email),
      attempts,
      delayMs,
    });

    await this.sleep(delayMs);
  }

  async recordFailure(email: string): Promise<BruteForceRecordResult> {
    if (!this.enabled) {
      return { attempts: 0, captchaRequired: false };
    }

    const normalised = normaliseEmail(email);
    const key = this.buildKey(normalised);
    const result = await this.consumeWithFallback(key);
    const attempts = result.consumedPoints;
    const captchaRequired = attempts >= this.config.captchaThreshold;

    this.logger.warn("Login failure tracked for brute force protection", {
      email: normalised,
      attempts,
      captchaRequired,
      retryAfterMs: result.msBeforeNext,
    });

    return { attempts, captchaRequired };
  }

  async reset(email: string): Promise<void> {
    if (!this.enabled) {
      return;
    }

    const key = this.buildKey(email);
    try {
      await this.limiter.delete(key);
    } catch (error) {
      this.logger.error("Failed to reset brute force counter", {
        error,
        prefix: this.keyPrefix,
        email: normaliseEmail(email),
      });
    }
  }
}

export const createBruteForceProtectionService = (
  options: BruteForceProtectionOptions = {},
): BruteForceProtectionService => new BruteForceProtectionService(options);
