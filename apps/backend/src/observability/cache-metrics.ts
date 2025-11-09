import type { Counter as PromCounter } from "prom-client";

import { logger } from "@/lib/logger.js";

import { createCounter, isMetricsCollectionEnabled } from "./metrics.js";

export type CatalogCacheMetricScope = "products" | "categories" | "popular";

const createScopeCounter = (name: string, help: string) =>
  createCounter({
    name,
    help,
    labelNames: ["scope"],
  });

const cacheHitCounter = createScopeCounter(
  "catalog_cache_hit_total",
  "Counts catalog cache hits grouped by scope.",
);

const cacheMissCounter = createScopeCounter(
  "catalog_cache_miss_total",
  "Counts catalog cache misses grouped by scope.",
);

const cacheInvalidationCounter = createScopeCounter(
  "catalog_cache_invalidation_total",
  "Counts catalog cache invalidations grouped by scope.",
);

const incrementCounter = (
  counter: PromCounter<string>,
  scope: CatalogCacheMetricScope,
  metric: string,
) => {
  if (!isMetricsCollectionEnabled()) {
    return;
  }

  try {
    counter.labels(scope).inc();
  } catch (error) {
    logger.debug("Failed to increment catalog cache metric", {
      scope,
      metric,
      error,
    });
  }
};

export const recordCatalogCacheHit = (scope: CatalogCacheMetricScope): void => {
  incrementCounter(cacheHitCounter, scope, "catalog_cache_hit_total");
};

export const recordCatalogCacheMiss = (scope: CatalogCacheMetricScope): void => {
  incrementCounter(cacheMissCounter, scope, "catalog_cache_miss_total");
};

export const recordCatalogCacheInvalidation = (scope: CatalogCacheMetricScope): void => {
  incrementCounter(cacheInvalidationCounter, scope, "catalog_cache_invalidation_total");
};

export const cacheMetricsInternals = {
  get hitCounter() {
    return cacheHitCounter;
  },
  get missCounter() {
    return cacheMissCounter;
  },
  get invalidationCounter() {
    return cacheInvalidationCounter;
  },
};
