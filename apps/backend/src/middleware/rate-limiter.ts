import type { Request, Response } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Options, RateLimitRequestHandler } from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import { createClient } from "redis";

import type { ApplicationConfig } from "@lumi/types";

import { getConfig } from "../config/index.js";
import { logger } from "../lib/logger.js";
import { formatError } from "./response-formatter.js";

const INTERNAL_BYPASS_HEADER = "x-internal-service";
const DEFAULT_INTERNAL_BYPASS_TOKEN = "internal";

type RedisClient = ReturnType<typeof createClient>;

let redisClient: RedisClient | undefined;

const getRedisClient = (config: ApplicationConfig): RedisClient | undefined => {
  if (redisClient) {
    return redisClient;
  }

  const redisUrl = config.security.rateLimit.redis?.url ?? config.cache.redisUrl;

  if (!redisUrl) {
    return undefined;
  }

  try {
    const client = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 50, 2000),
      },
    });

    client.on("error", (error) => {
      logger.error("Redis rate limiter client encountered an error", { error });
    });

    client.connect().catch((error) => {
      logger.error("Failed to establish Redis connection for rate limiter", { error });
    });

    redisClient = client;
    return client;
  } catch (error) {
    logger.error("Unable to construct Redis client for rate limiter", { error });
    return undefined;
  }
};

const isInternalRequest = (req: Request, token: string): boolean => {
  const headerValue = req.header(INTERNAL_BYPASS_HEADER);

  if (!headerValue) {
    return false;
  }

  return headerValue
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .includes(token.toLowerCase());
};

const toMilliseconds = (seconds: number) => Math.max(1000, seconds * 1000);

const createRedisStore = (config: ApplicationConfig) => {
  const client = getRedisClient(config);

  return client
    ? new RedisStore({
        sendCommand: async (...args: string[]) => client.sendCommand(args),
        prefix: config.security.rateLimit.keyPrefix ?? "lumi:rate-limit",
      })
    : undefined;
};

export interface RateLimiterOptions {
  /**
   * Optional override for the maximum number of requests within the window.
   */
  max?: number;
  /**
   * Optional override for the window size in seconds.
   */
  windowSeconds?: number;
  /**
   * Optional unique identifier used when logging and generating key prefixes.
   */
  identifier?: string;
  /**
   * When true, internal requests (identified via the X-Internal-Service header) bypass rate limiting.
   */
  allowInternalBypass?: boolean;
  /**
   * Optional override for the internal bypass header token.
   */
  internalBypassToken?: string;
}

const buildLimiterOptions = (
  config: ApplicationConfig,
  overrides: RateLimiterOptions,
  onLimitReached: (req: Request, res: Response) => void,
): Partial<Options> => {
  const rateConfig = config.security.rateLimit;

  const windowSeconds = overrides.windowSeconds ?? rateConfig.durationSeconds;

  return {
    windowMs: toMilliseconds(windowSeconds),
    max: overrides.max ?? rateConfig.points,
    standardHeaders: true,
    legacyHeaders: true,
    skipFailedRequests: false,
    keyGenerator: (req) => ipKeyGenerator(req.ip ?? req.socket.remoteAddress ?? ""),
    skip: (req) => {
      if (!rateConfig.enabled) {
        return true;
      }

      if (overrides.allowInternalBypass !== false) {
        const token = overrides.internalBypassToken ?? DEFAULT_INTERNAL_BYPASS_TOKEN;
        if (isInternalRequest(req, token)) {
          return true;
        }
      }

      return false;
    },
    handler: (req, res) => {
      onLimitReached(req, res);
    },
  };
};

const buildLimitReachedHandler = (identifier?: string) => (req: Request, res: Response) => {
  const requestId = res.requestId ?? req.requestId;

  logger.warn("Rate limit exceeded", {
    identifier,
    ip: req.ip,
    path: req.originalUrl,
    method: req.method,
    requestId,
  });

  const meta = {
    requestId,
  };

  const payload = {
    code: "RATE_LIMITED",
    message: "Too many requests. Please try again later.",
    details: [
      {
        message: "Rate limit exceeded",
        retryAfter: res.getHeader("Retry-After"),
      },
    ],
  };

  if (typeof res.error === "function") {
    res.status(429);
    res.error(payload, meta);
    return;
  }

  res.status(429).json(formatError(payload, meta));
};

export const createRateLimiter = (options: RateLimiterOptions = {}): RateLimitRequestHandler => {
  const config = getConfig();
  const handler = buildLimitReachedHandler(options.identifier);

  if (!config.security.rateLimit.enabled) {
    return ((req, _res, next) => {
      next();
    }) as RateLimitRequestHandler;
  }

  const limiterOptions: Partial<Options> = buildLimiterOptions(config, options, handler);

  if (config.security.rateLimit.strategy === "redis") {
    const store = createRedisStore(config);

    if (store) {
      limiterOptions.store = store;
    }
  }

  return rateLimit(limiterOptions);
};

export const createCustomerRateLimiter = (): RateLimitRequestHandler =>
  createRateLimiter({
    max: 120,
    windowSeconds: 300,
    identifier: "customer",
  });

export const createAdminRateLimiter = (): RateLimitRequestHandler =>
  createRateLimiter({
    max: 300,
    windowSeconds: 300,
    identifier: "admin",
    allowInternalBypass: false,
  });
