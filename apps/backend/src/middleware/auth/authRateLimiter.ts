import type { NextFunction, Request, RequestHandler, Response } from "express";
import {
  type RateLimiterAbstract,
  RateLimiterMemory,
  RateLimiterRedis,
  RateLimiterRes,
} from "rate-limiter-flexible";
import { createClient } from "redis";

import { createChildLogger } from "@/lib/logger.js";
import { errorResponse } from "@/lib/response.js";
import type { RateLimitStrategy } from "@lumi/types";

const AUTH_RATE_LIMITER_LOGGER = createChildLogger("middleware:auth:rate-limit");
const DEFAULT_ERROR_CODE = "RATE_LIMITED";
const DEFAULT_ERROR_MESSAGE = "Too many requests. Please try again later.";

export interface AuthRateLimiterOptions {
  keyPrefix: string;
  points: number;
  durationSeconds: number;
  blockDurationSeconds?: number;
  /**
   * Custom message returned to clients when the rate limit is exceeded.
   */
  message?: string;
  /**
   * Custom error code included in the response payload.
   */
  errorCode?: string;
  /**
   * Custom key generator to support per-user limits. Defaults to IP address.
   */
  keyGenerator?: (req: Request) => string | undefined;
  /**
   * Optional hook invoked when a rate limit breach occurs.
   */
  onLimitExceeded?: (context: {
    req: Request;
    res: Response;
    limiter: RateLimiterAbstract;
    rateLimiterResponse: RateLimiterRes;
    key: string;
  }) => void | Promise<void>;
  /**
   * Backend strategy for persisting limiter counters.
   */
  strategy?: RateLimitStrategy;
  /**
   * Redis connection string used when strategy is `redis`.
   */
  redisUrl?: string;
  /**
   * Optional list of IPs that should bypass limiter checks.
   */
  ipWhitelist?: readonly string[];
  /**
   * Optional logger override for unit testing.
   */
  logger?: ReturnType<typeof createChildLogger>;
}

const selectClientKey = (req: Request): string => {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    const first = forwarded
      .split(",")
      .map((segment) => segment.trim())
      .find((segment) => segment.length > 0);
    if (first) {
      return first;
    }
  }

  if (Array.isArray(forwarded) && forwarded.length > 0) {
    const candidate = forwarded[0];
    if (candidate) {
      return candidate;
    }
  }

  if (typeof req.ip === "string" && req.ip.length > 0) {
    return req.ip;
  }

  return "anonymous";
};

const computeRetryAfterSeconds = (rateLimiterResponse: RateLimiterRes): number => {
  const seconds = Math.ceil(rateLimiterResponse.msBeforeNext / 1000);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 1;
};

const initialiseRedisLimiter = (
  options: AuthRateLimiterOptions,
  logger: ReturnType<typeof createChildLogger>,
): RateLimiterRedis | undefined => {
  if (options.strategy !== "redis" || !options.redisUrl) {
    return undefined;
  }

  try {
    const client = createClient({ url: options.redisUrl });
    client.on("error", (error) => {
      logger.error("Authentication rate limiter Redis error", {
        error,
        prefix: options.keyPrefix,
      });
    });

    const limiter = new RateLimiterRedis({
      storeClient: client,
      keyPrefix: options.keyPrefix,
      points: options.points,
      duration: options.durationSeconds,
      blockDuration: options.blockDurationSeconds,
    });

    client.connect().catch((error) =>
      logger.error("Failed to connect Redis authentication rate limiter client", {
        error,
        prefix: options.keyPrefix,
        url: options.redisUrl,
      }),
    );

    return limiter;
  } catch (error) {
    logger.error("Unable to initialise Redis-backed authentication rate limiter", {
      error,
      prefix: options.keyPrefix,
      url: options.redisUrl,
    });

    return undefined;
  }
};

const consumeLimiter = async (
  key: string,
  redisLimiter: RateLimiterRedis | undefined,
  memoryLimiter: RateLimiterMemory,
  logger: ReturnType<typeof createChildLogger>,
  prefix: string,
): Promise<RateLimiterRes | void> => {
  if (!redisLimiter) {
    return memoryLimiter.consume(key);
  }

  try {
    return await redisLimiter.consume(key);
  } catch (error) {
    if (error instanceof RateLimiterRes) {
      throw error;
    }

    logger.error("Redis auth rate limiter failed; falling back to in-memory limiter", {
      error,
      prefix,
      key,
    });

    return memoryLimiter.consume(key);
  }
};

const triggerLimitExceededHook = (
  hook: AuthRateLimiterOptions["onLimitExceeded"],
  payload: {
    req: Request;
    res: Response;
    limiter: RateLimiterAbstract;
    rateLimiterResponse: RateLimiterRes;
    key: string;
  },
  logger: ReturnType<typeof createChildLogger>,
): void => {
  if (!hook) {
    return;
  }

  Promise.resolve(hook(payload)).catch((hookError) => {
    logger.error("Rate limit exceeded hook threw an error", {
      error: hookError,
    });
  });
};

export const createAuthRateLimiter = (options: AuthRateLimiterOptions): RequestHandler => {
  const logger = options.logger ?? AUTH_RATE_LIMITER_LOGGER;

  const inMemoryLimiter = new RateLimiterMemory({
    keyPrefix: options.keyPrefix,
    points: options.points,
    duration: options.durationSeconds,
    blockDuration: options.blockDurationSeconds,
  });

  const redisLimiter = initialiseRedisLimiter(options, logger);

  const whitelist = new Set(
    (options.ipWhitelist ?? []).map((ip) => ip.trim()).filter((ip): ip is string => ip.length > 0),
  );

  return async (req: Request, res: Response, next: NextFunction) => {
    const keyCandidate = options.keyGenerator?.(req);
    const clientKey = keyCandidate && keyCandidate.length > 0 ? keyCandidate : selectClientKey(req);
    const clientIp = selectClientKey(req);

    if (whitelist.has(clientIp)) {
      next();
      return;
    }

    try {
      await consumeLimiter(clientKey, redisLimiter, inMemoryLimiter, logger, options.keyPrefix);
      next();
    } catch (error) {
      const rateLimiterResponse = error instanceof RateLimiterRes ? error : undefined;

      if (!rateLimiterResponse) {
        next(error);
        return;
      }

      const retryAfterSeconds = computeRetryAfterSeconds(rateLimiterResponse);
      res.setHeader("Retry-After", retryAfterSeconds);

      logger.warn("Authentication rate limit exceeded", {
        key: clientKey,
        ip: clientIp,
        prefix: options.keyPrefix,
        retryAfterSeconds,
        remainingPoints: rateLimiterResponse.remainingPoints,
        consumedPoints: rateLimiterResponse.consumedPoints,
      });

      triggerLimitExceededHook(
        options.onLimitExceeded,
        {
          req,
          res,
          limiter: (redisLimiter ?? inMemoryLimiter) as RateLimiterAbstract,
          rateLimiterResponse,
          key: clientKey,
        },
        logger,
      );

      res.status(429).json(
        errorResponse({
          code: options.errorCode ?? DEFAULT_ERROR_CODE,
          message: options.message ?? DEFAULT_ERROR_MESSAGE,
          details: {
            retryAfterSeconds,
            key: clientKey,
            prefix: options.keyPrefix,
          },
        }),
      );
    }
  };
};
