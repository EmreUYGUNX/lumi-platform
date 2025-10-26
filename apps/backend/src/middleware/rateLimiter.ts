import type { RequestHandler } from "express";
import rateLimit, {
  MemoryStore,
  type RateLimitExceededEventHandler,
  type Options as RateLimitOptions,
  ipKeyGenerator,
} from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import { createClient } from "redis";

import type { ApplicationConfig, RateLimitRouteConfig } from "@lumi/types";

import { logger } from "../lib/logger.js";

export interface RateLimiterBundle {
  global: RequestHandler;
  auth: RequestHandler;
  cleanup: () => Promise<void>;
}

interface StoreFactoryResult {
  store?: RateLimitOptions["store"];
  teardown?: () => Promise<void>;
}

const NOOP_HANDLER: RequestHandler = (_request, _response, next) => {
  next();
};

const buildRedisStore = (
  config: ApplicationConfig["security"]["rateLimit"],
  scope: string,
): StoreFactoryResult => {
  if (config.strategy !== "redis" || !config.redis?.url) {
    return {};
  }

  try {
    const client = createClient({ url: config.redis.url });

    client.on("error", (error) => {
      logger.error("Redis rate limiter connection error", {
        error,
        scope,
        target: config.redis?.url,
      });
    });

    client.connect().catch((error) => {
      logger.error("Unable to establish Redis connection for rate limiting", {
        error,
        scope,
        target: config.redis?.url,
      });
    });

    const store = new RedisStore({
      prefix: `${config.keyPrefix}:${scope}`,
      resetExpiryOnChange: false,
      sendCommand: async (...args) => client.sendCommand(args),
    });

    return {
      store,
      teardown: async () => {
        if (client.isOpen) {
          await client.quit();
        }
      },
    };
  } catch (error) {
    logger.error("Failed to initialise Redis rate limiter store", {
      error,
      scope,
      target: config.redis?.url,
    });
    return {};
  }
};

const buildMemoryStore = (
  config: ApplicationConfig["security"]["rateLimit"],
): StoreFactoryResult => {
  if (config.strategy !== "memory") {
    return {};
  }

  const store = new MemoryStore();
  return { store };
};

const createStoreFactory = (
  config: ApplicationConfig["security"]["rateLimit"],
  scope: string,
): StoreFactoryResult => {
  const redisStore = buildRedisStore(config, scope);

  if (redisStore.store) {
    return redisStore;
  }

  const memoryStore = buildMemoryStore(config);
  if (memoryStore.store) {
    return memoryStore;
  }

  return {};
};

const RATE_LIMIT_ERROR_CODE = "RATE_LIMIT_EXCEEDED";
const RATE_LIMIT_ERROR_MESSAGE = "Too many requests. Please try again later.";

const createRateLimitHandler = (
  scope: string,
  routeConfig: RateLimitRouteConfig,
): RateLimitExceededEventHandler => {
  const retryAfterSeconds = Math.max(routeConfig.durationSeconds, routeConfig.blockDurationSeconds);

  return (request, response, _next, optionsUsed) => {
    response.setHeader("Retry-After", retryAfterSeconds);

    response.status(optionsUsed.statusCode).json({
      success: false,
      error: {
        code: RATE_LIMIT_ERROR_CODE,
        message: RATE_LIMIT_ERROR_MESSAGE,
        details: {
          retryAfterSeconds,
          scope,
          requestId: response.locals.requestId ?? request.id,
        },
      },
    });
  };
};

const createRateLimiter = (
  config: ApplicationConfig["security"]["rateLimit"],
  routeConfig: RateLimitRouteConfig,
  scope: string,
): { middleware: RequestHandler; teardown?: () => Promise<void> } => {
  const windowMs = routeConfig.durationSeconds * 1000;
  const storeFactory = createStoreFactory(config, scope);

  const limiter = rateLimit({
    windowMs,
    limit: routeConfig.points,
    standardHeaders: "draft-7",
    legacyHeaders: true,
    skipFailedRequests: false,
    skipSuccessfulRequests: false,
    handler: createRateLimitHandler(scope, routeConfig),
    store: storeFactory.store,
    passOnStoreError: true,
    keyGenerator: (request) => {
      const identifier = ipKeyGenerator(request.ip ?? "");
      return `${config.keyPrefix}:${scope}:${identifier}`;
    },
    statusCode: 429,
    validate: {
      creationStack: false,
    },
  });

  return {
    middleware: limiter,
    teardown: storeFactory.teardown,
  };
};

export const createRateLimiterBundle = (
  config: ApplicationConfig["security"]["rateLimit"],
): RateLimiterBundle => {
  if (!config.enabled) {
    return {
      global: NOOP_HANDLER,
      auth: NOOP_HANDLER,
      cleanup: async () => {},
    };
  }

  const teardowns: (() => Promise<void>)[] = [];

  const globalLimiter = createRateLimiter(
    config,
    {
      points: config.points,
      durationSeconds: config.durationSeconds,
      blockDurationSeconds: config.blockDurationSeconds,
    },
    "global",
  );

  if (globalLimiter.teardown) {
    teardowns.push(globalLimiter.teardown);
  }

  const authLimiter = createRateLimiter(config, config.routes.auth.global, "auth");

  if (authLimiter.teardown) {
    teardowns.push(authLimiter.teardown);
  }

  return {
    global: globalLimiter.middleware,
    auth: authLimiter.middleware,
    cleanup: async () => {
      await Promise.allSettled(
        teardowns.map(async (teardown) => {
          try {
            await teardown();
          } catch (error) {
            logger.warn("Failed to shutdown rate limiter store", { error });
          }
        }),
      );
    },
  };
};
