import type { NextFunction, Request, RequestHandler, Response } from "express";
import { RateLimiterMemory, RateLimiterRes } from "rate-limiter-flexible";

import { createChildLogger } from "@/lib/logger.js";
import { errorResponse } from "@/lib/response.js";

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
    limiter: RateLimiterMemory;
    rateLimiterResponse: RateLimiterRes;
    key: string;
  }) => void | Promise<void>;
}

const selectClientKey = (req: Request): string => {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    const [first] = forwarded.split(",").map((segment) => segment.trim());
    if (first) {
      return first;
    }
  }

  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0]!;
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

export const createAuthRateLimiter = (options: AuthRateLimiterOptions): RequestHandler => {
  const limiter = new RateLimiterMemory({
    keyPrefix: options.keyPrefix,
    points: options.points,
    duration: options.durationSeconds,
    blockDuration: options.blockDurationSeconds,
  });

  return async (req: Request, res: Response, next: NextFunction) => {
    const key = options.keyGenerator?.(req) ?? selectClientKey(req);

    try {
      await limiter.consume(key);
      next();
    } catch (error) {
      const rateLimiterResponse = error instanceof RateLimiterRes ? error : undefined;

      if (!rateLimiterResponse) {
        next(error);
        return;
      }

      const retryAfterSeconds = computeRetryAfterSeconds(rateLimiterResponse);
      res.setHeader("Retry-After", retryAfterSeconds);

      AUTH_RATE_LIMITER_LOGGER.warn("Authentication rate limit exceeded", {
        key,
        prefix: options.keyPrefix,
        retryAfterSeconds,
        remainingPoints: rateLimiterResponse.remainingPoints,
        consumedPoints: rateLimiterResponse.consumedPoints,
      });

      if (options.onLimitExceeded) {
        Promise.resolve(
          options.onLimitExceeded({
            req,
            res,
            limiter,
            rateLimiterResponse,
            key,
          }),
        ).catch((hookError) => {
          AUTH_RATE_LIMITER_LOGGER.error("Rate limit exceeded hook threw an error", {
            error: hookError,
          });
        });
      }

      res.status(429).json(
        errorResponse({
          code: options.errorCode ?? DEFAULT_ERROR_CODE,
          message: options.message ?? DEFAULT_ERROR_MESSAGE,
          details: {
            retryAfterSeconds,
            key,
            prefix: options.keyPrefix,
          },
        }),
      );
    }
  };
};
