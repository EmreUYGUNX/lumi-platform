import { setTimeout as delay } from "node:timers/promises";

import { getConfig } from "@/config/index.js";
import { createChildLogger } from "@/lib/logger.js";
import { type RedisClientInstance as RedisClientLike, createRedisClient } from "@/lib/redis.js";
import type { PaginatedResult } from "@/lib/repository/base.repository.js";
import type { CatalogCacheMetricScope } from "@/observability/cache-metrics.js";
import {
  recordCatalogCacheHit,
  recordCatalogCacheInvalidation,
  recordCatalogCacheMiss,
} from "@/observability/cache-metrics.js";
import type { CategorySummaryDTO, ProductSummaryDTO } from "@lumi/shared/dto";

export interface CategoryTreeNode extends CategorySummaryDTO {
  children: CategoryTreeNode[];
  productCount?: number;
}

export interface CatalogCache {
  getProductList(key: string): Promise<PaginatedResult<ProductSummaryDTO> | undefined>;
  setProductList(
    key: string,
    value: PaginatedResult<ProductSummaryDTO>,
    ttlSeconds?: number,
  ): Promise<void>;
  invalidateProductLists(): Promise<void>;
  getCategoryTree(key: string): Promise<CategoryTreeNode[] | undefined>;
  setCategoryTree(key: string, value: CategoryTreeNode[], ttlSeconds?: number): Promise<void>;
  invalidateCategoryTrees(): Promise<void>;
  getPopularProducts(key: string): Promise<ProductSummaryDTO[] | undefined>;
  setPopularProducts(key: string, value: ProductSummaryDTO[], ttlSeconds?: number): Promise<void>;
  invalidatePopularProducts(): Promise<void>;
  shutdown(): Promise<void>;
}

const PRODUCT_CACHE_PREFIX = "catalog:products";
const CATEGORY_CACHE_PREFIX = "catalog:categories";
const POPULAR_CACHE_PREFIX = "catalog:popular";
const DEFAULT_PRODUCT_TTL_SECONDS = 60;
const DEFAULT_CATEGORY_TTL_SECONDS = 15 * 60;
const DEFAULT_POPULAR_TTL_SECONDS = 5 * 60;
const REDIS_RETRY_DELAY_MS = 250;
const REDIS_MAX_RETRIES = 3;

type ChildLogger = ReturnType<typeof createChildLogger>;
type RedisClientInstance = RedisClientLike;

const serialiseCacheValue = (value: unknown): string =>
  JSON.stringify({ value, cachedAt: Date.now() });

const deserialiseCacheValue = <T>(payload: string | null, logger: ChildLogger): T | undefined => {
  if (!payload) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(payload) as { value?: unknown };
    return parsed.value as T;
  } catch (error) {
    logger.warn("Failed to parse cached catalog payload", { error });
    return undefined;
  }
};

const buildCacheKey = (prefix: string, key: string): string => `${prefix}:${key}`;

const recordLookup = <T>(scope: CatalogCacheMetricScope, value: T | undefined): T | undefined => {
  if (value === undefined) {
    recordCatalogCacheMiss(scope);
  } else {
    recordCatalogCacheHit(scope);
  }

  return value;
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
      // eslint-disable-next-line no-await-in-loop -- deliberate backoff between retries
      await delay(REDIS_RETRY_DELAY_MS);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Catalog cache operation failed");
};

const createRedisCatalogCache = (
  client: RedisClientInstance,
  logger = createChildLogger("catalog:cache:redis"),
): CatalogCache => {
  let connected = false;
  let connectionFailed = false;
  const fallback = createInMemoryCatalogCache();

  const markFailure = (error: unknown) => {
    if (!connectionFailed) {
      logger.error("Redis catalog cache client error", { error });
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

  const deleteByPattern = async (pattern: string): Promise<boolean> =>
    withFallback(
      async () => {
        await ensureConnected();
        if (connectionFailed) {
          return false;
        }

        let cursor = "0";

        do {
          const currentCursor = cursor;
          // eslint-disable-next-line no-await-in-loop -- sequential scan required
          const result = await executeWithRetry(() =>
            client.scan(currentCursor, {
              MATCH: pattern,
              COUNT: 64,
            }),
          );
          cursor = result.cursor;

          if (result.keys.length > 0) {
            // eslint-disable-next-line no-await-in-loop -- sequential deletion required
            await executeWithRetry(() => client.del(result.keys));
          }
        } while (cursor !== "0");

        return true;
      },
      async () => {
        if (pattern.startsWith(PRODUCT_CACHE_PREFIX)) {
          await fallback.invalidateProductLists();
        } else if (pattern.startsWith(CATEGORY_CACHE_PREFIX)) {
          await fallback.invalidateCategoryTrees();
        } else if (pattern.startsWith(POPULAR_CACHE_PREFIX)) {
          await fallback.invalidatePopularProducts();
        }

        return false;
      },
    );

  return {
    async getProductList(key) {
      const cacheKey = buildCacheKey(PRODUCT_CACHE_PREFIX, key);
      const result = await withFallback(
        async () => {
          const payload = await executeWithRetry(() => client.get(cacheKey));
          return deserialiseCacheValue<PaginatedResult<ProductSummaryDTO>>(payload, logger);
        },
        () => fallback.getProductList(key),
      );
      return recordLookup("products", result);
    },
    async setProductList(key, value, ttlSeconds = DEFAULT_PRODUCT_TTL_SECONDS) {
      const cacheKey = buildCacheKey(PRODUCT_CACHE_PREFIX, key);
      await withFallback(
        async () => {
          const payload = serialiseCacheValue(value);
          await executeWithRetry(() =>
            client.set(cacheKey, payload, {
              EX: ttlSeconds,
            }),
          );
        },
        () => fallback.setProductList(key, value, ttlSeconds),
      );
    },
    async invalidateProductLists() {
      const pattern = `${PRODUCT_CACHE_PREFIX}:*`;
      const handledByRedis = await deleteByPattern(pattern);
      if (handledByRedis) {
        recordCatalogCacheInvalidation("products");
      }
    },
    async getCategoryTree(key) {
      const cacheKey = buildCacheKey(CATEGORY_CACHE_PREFIX, key);
      const result = await withFallback(
        async () => {
          const payload = await executeWithRetry(() => client.get(cacheKey));
          return deserialiseCacheValue<CategoryTreeNode[]>(payload, logger);
        },
        () => fallback.getCategoryTree(key),
      );
      return recordLookup("categories", result);
    },
    async setCategoryTree(key, value, ttlSeconds = DEFAULT_CATEGORY_TTL_SECONDS) {
      const cacheKey = buildCacheKey(CATEGORY_CACHE_PREFIX, key);
      await withFallback(
        async () => {
          const payload = serialiseCacheValue(value);
          await executeWithRetry(() =>
            client.set(cacheKey, payload, {
              EX: ttlSeconds,
            }),
          );
        },
        () => fallback.setCategoryTree(key, value, ttlSeconds),
      );
    },
    async invalidateCategoryTrees() {
      const pattern = `${CATEGORY_CACHE_PREFIX}:*`;
      const handledByRedis = await deleteByPattern(pattern);
      if (handledByRedis) {
        recordCatalogCacheInvalidation("categories");
      }
    },
    async getPopularProducts(key) {
      const cacheKey = buildCacheKey(POPULAR_CACHE_PREFIX, key);
      const result = await withFallback(
        async () => {
          const payload = await executeWithRetry(() => client.get(cacheKey));
          return deserialiseCacheValue<ProductSummaryDTO[]>(payload, logger);
        },
        () => fallback.getPopularProducts(key),
      );
      return recordLookup("popular", result);
    },
    async setPopularProducts(key, value, ttlSeconds = DEFAULT_POPULAR_TTL_SECONDS) {
      const cacheKey = buildCacheKey(POPULAR_CACHE_PREFIX, key);
      await withFallback(
        async () => {
          const payload = serialiseCacheValue(value);
          await executeWithRetry(() =>
            client.set(cacheKey, payload, {
              EX: ttlSeconds,
            }),
          );
        },
        () => fallback.setPopularProducts(key, value, ttlSeconds),
      );
    },
    async invalidatePopularProducts() {
      const pattern = `${POPULAR_CACHE_PREFIX}:*`;
      const handledByRedis = await deleteByPattern(pattern);
      if (handledByRedis) {
        recordCatalogCacheInvalidation("popular");
      }
    },
    async shutdown() {
      if (connectionFailed) {
        await fallback.shutdown();
        return;
      }

      try {
        if (connected || client.isOpen) {
          await client.quit();
        }
      } catch (error) {
        logger.warn("Failed to close Redis catalog cache client cleanly", { error });
      } finally {
        connected = false;
      }

      await fallback.shutdown();
    },
  };
};

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

function createInMemoryCatalogCache(): CatalogCache {
  const productStore = new Map<string, CacheEntry<PaginatedResult<ProductSummaryDTO>>>();
  const categoryStore = new Map<string, CacheEntry<CategoryTreeNode[]>>();
  const popularStore = new Map<string, CacheEntry<ProductSummaryDTO[]>>();

  const cleanup = <T>(store: Map<string, CacheEntry<T>>) => {
    const now = Date.now();
    store.forEach((entry, key) => {
      if (entry.expiresAt <= now) {
        store.delete(key);
      }
    });
  };

  return {
    async getProductList(key) {
      cleanup(productStore);
      const entry = productStore.get(key);
      return recordLookup("products", entry ? entry.value : undefined);
    },
    async setProductList(key, value, ttlSeconds = DEFAULT_PRODUCT_TTL_SECONDS) {
      const expiresAt = Date.now() + ttlSeconds * 1000;
      productStore.set(key, { value, expiresAt });
    },
    async invalidateProductLists() {
      productStore.clear();
      recordCatalogCacheInvalidation("products");
    },
    async getCategoryTree(key) {
      cleanup(categoryStore);
      const entry = categoryStore.get(key);
      return recordLookup("categories", entry ? entry.value : undefined);
    },
    async setCategoryTree(key, value, ttlSeconds = DEFAULT_CATEGORY_TTL_SECONDS) {
      const expiresAt = Date.now() + ttlSeconds * 1000;
      categoryStore.set(key, { value, expiresAt });
    },
    async invalidateCategoryTrees() {
      categoryStore.clear();
      recordCatalogCacheInvalidation("categories");
    },
    async getPopularProducts(key) {
      cleanup(popularStore);
      const entry = popularStore.get(key);
      return recordLookup("popular", entry ? entry.value : undefined);
    },
    async setPopularProducts(key, value, ttlSeconds = DEFAULT_POPULAR_TTL_SECONDS) {
      const expiresAt = Date.now() + ttlSeconds * 1000;
      popularStore.set(key, { value, expiresAt });
    },
    async invalidatePopularProducts() {
      popularStore.clear();
      recordCatalogCacheInvalidation("popular");
    },
    async shutdown() {
      productStore.clear();
      categoryStore.clear();
      popularStore.clear();
    },
  };
}

export const createCatalogCache = (): CatalogCache => {
  const logger = createChildLogger("catalog:cache");

  try {
    const { cache } = getConfig();
    const { redisUrl } = cache;
    if (!redisUrl) {
      logger.warn("Redis URL not configured. Using in-memory catalog cache.");
      return createInMemoryCatalogCache();
    }

    const client = createRedisClient({
      url: redisUrl,
      name: "catalog-cache",
    });

    return createRedisCatalogCache(client);
  } catch (error) {
    logger.error("Failed to initialise Redis catalog cache. Falling back to in-memory cache.", {
      error,
    });
    return createInMemoryCatalogCache();
  }
};
