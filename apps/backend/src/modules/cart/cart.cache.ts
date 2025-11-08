import { getConfig } from "@/config/index.js";
import { createChildLogger } from "@/lib/logger.js";

import type { CartSummaryView } from "./cart.types.js";

export type CartCacheScope = "user" | "session";

export interface CartCacheKey {
  scope: CartCacheScope;
  key: string;
}

interface CartCacheEntry {
  payload: CartSummaryView;
  expiresAt: number;
  cartId: string;
}

export interface CartCache {
  get(scope: CartCacheScope, key: string): Promise<CartSummaryView | undefined>;
  set(scope: CartCacheScope, key: string, cartId: string, payload: CartSummaryView): Promise<void>;
  invalidate(scope: CartCacheScope, key: string): Promise<void>;
  invalidateByCartId(cartId: string): Promise<void>;
  shutdown(): Promise<void>;
}

const DEFAULT_TTL_MS = 60_000;

const buildCompositeKey = (scope: CartCacheScope, key: string): string => `${scope}:${key}`;

class InMemoryCartCache implements CartCache {
  private readonly store = new Map<string, CartCacheEntry>();

  private readonly cartIndex = new Map<string, Set<string>>();

  private readonly ttlMs: number;

  private readonly logger = createChildLogger("cart:cache");

  constructor(ttlMs = DEFAULT_TTL_MS) {
    this.ttlMs = Math.max(1e3, ttlMs);
  }

  private cleanupExpired(now = Date.now()): void {
    this.store.forEach((entry, compositeKey) => {
      if (entry.expiresAt <= now) {
        this.store.delete(compositeKey);
      }
    });
    // Rebuild cart index to remove stale mappings.
    this.cartIndex.forEach((keys, cartId) => {
      const activeKeys = [...keys].filter((key) => this.store.has(key));
      if (activeKeys.length === 0) {
        this.cartIndex.delete(cartId);
      } else if (activeKeys.length !== keys.size) {
        this.cartIndex.set(cartId, new Set(activeKeys));
      }
    });
  }

  private trackIndex(cartId: string, compositeKey: string): void {
    const entry = this.cartIndex.get(cartId);
    if (entry) {
      entry.add(compositeKey);
      return;
    }

    this.cartIndex.set(cartId, new Set([compositeKey]));
  }

  async get(scope: CartCacheScope, key: string): Promise<CartSummaryView | undefined> {
    this.cleanupExpired();
    const compositeKey = buildCompositeKey(scope, key);
    const entry = this.store.get(compositeKey);
    return entry?.payload;
  }

  async set(
    scope: CartCacheScope,
    key: string,
    cartId: string,
    payload: CartSummaryView,
  ): Promise<void> {
    const compositeKey = buildCompositeKey(scope, key);
    const expiresAt = Date.now() + this.ttlMs;
    this.store.set(compositeKey, { payload, expiresAt, cartId });
    this.trackIndex(cartId, compositeKey);
  }

  async invalidate(scope: CartCacheScope, key: string): Promise<void> {
    const compositeKey = buildCompositeKey(scope, key);
    const entry = this.store.get(compositeKey);
    if (!entry) {
      return;
    }

    this.store.delete(compositeKey);
    const keys = this.cartIndex.get(entry.cartId);
    keys?.delete(compositeKey);
    if (keys && keys.size === 0) {
      this.cartIndex.delete(entry.cartId);
    }
  }

  async invalidateByCartId(cartId: string): Promise<void> {
    const keys = this.cartIndex.get(cartId);
    if (!keys || keys.size === 0) {
      return;
    }

    keys.forEach((compositeKey) => {
      this.store.delete(compositeKey);
    });

    this.cartIndex.delete(cartId);
  }

  async shutdown(): Promise<void> {
    this.logger.debug("Cart cache shutdown requested. Clearing in-memory state.");
    this.store.clear();
    this.cartIndex.clear();
  }
}

export const createCartCache = (): CartCache => {
  const {
    cache: { redisUrl },
  } = getConfig();

  if (redisUrl) {
    // TODO: Integrate Redis-backed cart cache (Phase 4 performance enhancements).
    createChildLogger("cart:cache").debug(
      "Redis URL detected but cart cache is currently using the in-memory driver. Redis integration will be introduced in a future phase.",
      { redisUrl },
    );
  }

  return new InMemoryCartCache();
};
