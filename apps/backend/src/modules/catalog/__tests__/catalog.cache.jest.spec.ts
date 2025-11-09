/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/array-type, unicorn/no-useless-undefined */
// @ts-nocheck
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

const loggerInstances: Array<{ warn: jest.Mock; error: jest.Mock; debug: jest.Mock }> = [];
const configState: { redisUrl?: string } = {};

const createRedisClientMock = jest.fn();

jest.mock("@/config/index.js", () => ({
  getConfig: jest.fn(() => ({
    cache: {
      redisUrl: configState.redisUrl,
    },
  })),
}));

jest.mock("@/lib/logger.js", () => ({
  createChildLogger: jest.fn(() => {
    const instance = {
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    loggerInstances.push(instance);
    return instance;
  }),
}));

jest.mock("@/lib/redis.js", () => ({
  createRedisClient: (...args: unknown[]) => createRedisClientMock(...args),
}));

jest.mock("@/observability/cache-metrics.js", () => ({
  recordCatalogCacheHit: jest.fn(),
  recordCatalogCacheMiss: jest.fn(),
  recordCatalogCacheInvalidation: jest.fn(),
}));

const importCatalogCache = async () => import("../catalog.cache.js");

const createSampleProductList = () => ({
  items: [
    {
      id: "prod_1",
      title: "Aurora Lamp",
    },
  ],
  meta: {
    page: 1,
    pageSize: 24,
    totalItems: 1,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  },
});

describe("catalog cache", () => {
  beforeEach(() => {
    configState.redisUrl = undefined;
    createRedisClientMock.mockReset();
    loggerInstances.length = 0;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("uses in-memory cache when Redis URL is not configured", async () => {
    const { createCatalogCache } = await importCatalogCache();
    const cache = createCatalogCache();

    const payload = createSampleProductList();

    await cache.setProductList("public", payload);
    const result = await cache.getProductList("public");

    expect(result).toEqual(payload);
    expect(createRedisClientMock).not.toHaveBeenCalled();

    await cache.shutdown();
  });

  it("falls back to in-memory cache when Redis connection fails", async () => {
    configState.redisUrl = "redis://localhost:6379";
    const redisClient = {
      isOpen: false,
      connect: jest.fn().mockRejectedValue(new Error("ECONNREFUSED")),
      get: jest.fn(),
      set: jest.fn(),
      scan: jest.fn(),
      del: jest.fn(),
      quit: jest.fn().mockResolvedValue(undefined),
      on: jest.fn().mockReturnThis(),
    };

    createRedisClientMock.mockReturnValue(redisClient);

    const { createCatalogCache } = await importCatalogCache();
    const cache = createCatalogCache();

    const payload = createSampleProductList();

    await cache.setProductList("public", payload);
    const result = await cache.getProductList("public");

    expect(result).toEqual(payload);
    expect(redisClient.connect).toHaveBeenCalledTimes(1);
    expect(createRedisClientMock).toHaveBeenCalledTimes(1);

    const logger = loggerInstances.at(-1);
    expect(logger?.error).toHaveBeenCalled();

    await cache.invalidateProductLists();
    await cache.invalidateCategoryTrees();
    await cache.invalidatePopularProducts();
    await cache.shutdown();
  });

  it("caches and invalidates popular products with in-memory driver", async () => {
    const { createCatalogCache } = await importCatalogCache();
    const cache = createCatalogCache();

    const popularProducts = [
      {
        id: "prod_popular",
        title: "Nebula Speaker",
      },
    ];

    expect(await cache.getPopularProducts("homepage")).toBeUndefined();

    await cache.setPopularProducts("homepage", popularProducts, 1);
    const cached = await cache.getPopularProducts("homepage");
    expect(cached).toEqual(popularProducts);

    await cache.invalidatePopularProducts();
    expect(await cache.getPopularProducts("homepage")).toBeUndefined();

    await cache.shutdown();
  });
});
