import { setTimeout as delay } from "node:timers/promises";

import { getConfig } from "@/config/index.js";
import { createChildLogger } from "@/lib/logger.js";
import { type RedisClientInstance as RedisClientLike, createRedisClient } from "@/lib/redis.js";

export interface CachedPreviewPayload {
  previewUrl: string;
  cachedAt: string;
  expiresAt: string;
  resolution: string;
  designArea: string;
}

export interface PreviewCacheEntry {
  previewId: string;
  payload: CachedPreviewPayload;
}

export interface PreviewCache {
  get(previewId: string): Promise<CachedPreviewPayload | undefined>;
  set(previewId: string, payload: CachedPreviewPayload, ttlSeconds: number): Promise<void>;
  invalidateByProduct(productId: string): Promise<void>;
  shutdown(): Promise<void>;
}

const KEY_PREFIX = "preview";
const REDIS_RETRY_DELAY_MS = 200;
const REDIS_MAX_RETRIES = 3;

type RedisClientInstance = RedisClientLike;
type ChildLogger = ReturnType<typeof createChildLogger>;

const buildKey = (previewId: string) => `${KEY_PREFIX}:${previewId}`;

const serialise = (payload: CachedPreviewPayload): string =>
  JSON.stringify({
    ...payload,
    cachedAt: payload.cachedAt ?? new Date().toISOString(),
  });

const deserialise = (
  value: string | null,
  logger: ChildLogger,
): CachedPreviewPayload | undefined => {
  if (!value) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value) as Partial<CachedPreviewPayload>;
    if (typeof parsed.previewUrl !== "string" || parsed.previewUrl.length === 0) {
      return undefined;
    }

    if (typeof parsed.expiresAt !== "string" || parsed.expiresAt.length === 0) {
      return undefined;
    }

    return {
      previewUrl: parsed.previewUrl,
      cachedAt: typeof parsed.cachedAt === "string" ? parsed.cachedAt : new Date().toISOString(),
      expiresAt: parsed.expiresAt,
      resolution: typeof parsed.resolution === "string" ? parsed.resolution : "web",
      designArea: typeof parsed.designArea === "string" ? parsed.designArea : "unknown",
    };
  } catch (error) {
    logger.warn("Failed to parse cached preview payload", { error });
    return undefined;
  }
};

const executeWithRetry = async <T>(operation: () => Promise<T>): Promise<T> => {
  let attempt = 0;
  let lastError: unknown;

  while (attempt < REDIS_MAX_RETRIES) {
    attempt += 1;
    try {
      // eslint-disable-next-line no-await-in-loop -- sequential retry required
      return await operation();
    } catch (error) {
      lastError = error;
      // eslint-disable-next-line no-await-in-loop -- backoff between retries
      await delay(REDIS_RETRY_DELAY_MS);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Preview cache operation failed");
};

const createInMemoryPreviewCache = (
  logger = createChildLogger("preview:cache:memory"),
): PreviewCache => {
  const entries = new Map<string, { payload: CachedPreviewPayload; expiresAtMs: number }>();

  const cleanupExpired = () => {
    const now = Date.now();
    entries.forEach((value, key) => {
      if (value.expiresAtMs <= now) {
        entries.delete(key);
      }
    });
  };

  return {
    async get(previewId) {
      cleanupExpired();
      const key = buildKey(previewId);
      const entry = entries.get(key);
      let payload: CachedPreviewPayload | undefined;

      if (entry) {
        if (entry.expiresAtMs <= Date.now()) {
          entries.delete(key);
        } else {
          payload = entry.payload;
        }
      }

      return payload;
    },
    async set(previewId, payload, ttlSeconds) {
      const key = buildKey(previewId);
      const expiresAtMs = Date.now() + Math.max(1, Math.ceil(ttlSeconds)) * 1000;
      entries.set(key, {
        payload: {
          ...payload,
          cachedAt: payload.cachedAt ?? new Date().toISOString(),
          expiresAt: payload.expiresAt ?? new Date(expiresAtMs).toISOString(),
        },
        expiresAtMs,
      });
    },
    async invalidateByProduct(productId) {
      if (productId === "*") {
        entries.clear();
        return;
      }

      const prefix = buildKey(`${productId}:`);
      entries.forEach((_value, key) => {
        if (key.startsWith(prefix)) {
          entries.delete(key);
        }
      });
      logger.debug("Invalidated in-memory preview cache", { productId });
    },
    async shutdown() {
      entries.clear();
    },
  };
};

const createRedisPreviewCache = (
  client: RedisClientInstance,
  logger = createChildLogger("preview:cache:redis"),
): PreviewCache => {
  let connected = false;
  let connectionFailed = false;
  const fallback = createInMemoryPreviewCache();

  const markFailure = (error: unknown) => {
    if (!connectionFailed) {
      logger.error("Redis preview cache client error", { error });
    }
    connectionFailed = true;
  };

  const ensureConnected = async () => {
    if (connectionFailed) {
      return;
    }

    if (connected || client.isOpen) {
      connected = true;
      return;
    }

    try {
      await client.connect();
      connected = true;
    } catch (error) {
      markFailure(error);
    }
  };

  const withFallback = async <T>(
    operation: () => Promise<T>,
    fallbackOperation: () => Promise<T>,
  ) => {
    if (connectionFailed) {
      return fallbackOperation();
    }

    try {
      await ensureConnected();
      if (connectionFailed) {
        return fallbackOperation();
      }

      return await operation();
    } catch (error) {
      markFailure(error);
      return fallbackOperation();
    }
  };

  const deleteByPattern = async (pattern: string): Promise<void> => {
    await withFallback(
      async () => {
        await ensureConnected();
        if (connectionFailed) {
          return;
        }

        let cursor = "0";

        do {
          const currentCursor = cursor;
          // eslint-disable-next-line no-await-in-loop -- sequential scan required
          const result = await executeWithRetry(() =>
            client.scan(currentCursor, {
              MATCH: pattern,
              COUNT: 128,
            }),
          );
          cursor = result.cursor;

          if (result.keys.length > 0) {
            // eslint-disable-next-line no-await-in-loop -- sequential deletion required
            await executeWithRetry(() => client.del(result.keys));
          }
        } while (cursor !== "0");
      },
      () => fallback.invalidateByProduct("*"),
    );
  };

  return {
    async get(previewId) {
      const key = buildKey(previewId);
      return withFallback(
        async () => {
          const payload = await executeWithRetry(() => client.get(key));
          return deserialise(payload, logger);
        },
        () => fallback.get(previewId),
      );
    },
    async set(previewId, payload, ttlSeconds) {
      const key = buildKey(previewId);
      await withFallback(
        async () => {
          const value = serialise(payload);
          await executeWithRetry(() =>
            client.set(key, value, {
              EX: Math.max(1, Math.ceil(ttlSeconds)),
            }),
          );
        },
        () => fallback.set(previewId, payload, ttlSeconds),
      );
    },
    async invalidateByProduct(productId) {
      const pattern = productId === "*" ? `${KEY_PREFIX}:*` : `${KEY_PREFIX}:${productId}:*`;
      await deleteByPattern(pattern);
    },
    async shutdown() {
      await fallback.shutdown();

      if (!connected || !client.isOpen) {
        return;
      }

      try {
        await client.quit();
      } catch (error) {
        logger.warn("Redis preview cache shutdown encountered an error", { error });
      } finally {
        connected = false;
      }
    },
  };
};

export interface PreviewCacheFactoryOptions {
  url?: string;
}

export const createPreviewCache = (options: PreviewCacheFactoryOptions = {}): PreviewCache => {
  const logger = createChildLogger("preview:cache");
  const url = options.url ?? getConfig().cache.redisUrl;

  if (!url) {
    logger.warn("Redis URL not configured; falling back to in-memory preview cache.");
    return createInMemoryPreviewCache();
  }

  try {
    const client = createRedisClient({ url, name: "lumi-backend-preview" });
    return createRedisPreviewCache(client);
  } catch (error) {
    logger.error("Failed to create Redis preview cache client; using in-memory cache.", { error });
    return createInMemoryPreviewCache();
  }
};
