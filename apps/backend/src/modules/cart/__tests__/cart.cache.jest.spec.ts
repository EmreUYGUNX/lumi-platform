import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import { getConfig } from "@/config/index.js";
import type { ApplicationConfig } from "@lumi/types";

import { createCartCache } from "../cart.cache.js";
import type { CartSummaryView } from "../cart.types.js";

jest.mock("@/config/index.js", () => ({
  __esModule: true,
  getConfig: jest.fn(() => ({
    cache: {
      redisUrl: undefined,
    },
  })),
}));

const mockGetConfig = getConfig as jest.MockedFunction<typeof getConfig>;

const createView = (overrides: Partial<CartSummaryView> = {}): CartSummaryView => ({
  cart: {
    id: "cart-id",
    userId: "user-id",
    sessionId: "session-id",
    status: "ACTIVE",
    expiresAt: null, // eslint-disable-line unicorn/no-null -- carts may have no explicit expiry
    items: [],
    totals: {
      subtotal: { amount: "0.00", currency: "TRY" },
      tax: { amount: "0.00", currency: "TRY" },
      discount: { amount: "0.00", currency: "TRY" },
      total: { amount: "0.00", currency: "TRY" },
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  stock: {
    status: "ok",
    issues: [],
    checkedAt: new Date().toISOString(),
  },
  delivery: {
    status: "standard",
    minHours: 24,
    maxHours: 72,
    estimatedDeliveryDate: new Date().toISOString(),
    message: "Standard delivery",
  },
  ...overrides,
});

describe("InMemoryCartCache", () => {
  beforeEach(() => {
    mockGetConfig.mockReturnValue({
      cache: { redisUrl: undefined },
    } as unknown as ApplicationConfig);
  });

  it("stores and retrieves cached cart views per scope", async () => {
    const cache = createCartCache();
    const view = createView();

    await cache.set("user", "user-1", "cart-1", view);
    await cache.set("session", "session-1", "cart-1", view);

    await expect(cache.get("user", "user-1")).resolves.toEqual(view);
    await expect(cache.get("session", "session-1")).resolves.toEqual(view);

    await cache.invalidate("user", "user-1");

    await expect(cache.get("user", "user-1")).resolves.toBeUndefined();
    await expect(cache.get("session", "session-1")).resolves.toEqual(view);
  });

  it("expires entries based on the configured TTL", async () => {
    const cache = createCartCache();
    const view = createView();
    const nowSpy = jest.spyOn(Date, "now");

    nowSpy.mockReturnValueOnce(0);
    await cache.set("user", "expiring-user", "cart-expiring", view);

    nowSpy.mockReturnValueOnce(61_000);
    await expect(cache.get("user", "expiring-user")).resolves.toBeUndefined();

    nowSpy.mockRestore();
  });

  it("invalidates all keys associated with a cart identifier", async () => {
    const cache = createCartCache();
    const view = createView();

    await cache.set("user", "user-a", "cart-shared", view);
    await cache.set("session", "session-a", "cart-shared", view);

    await cache.invalidateByCartId("cart-shared");

    await expect(cache.get("user", "user-a")).resolves.toBeUndefined();
    await expect(cache.get("session", "session-a")).resolves.toBeUndefined();
  });

  it("returns an in-memory cache even when Redis is configured", async () => {
    mockGetConfig.mockReturnValue({
      cache: { redisUrl: "redis://example" },
    } as unknown as ApplicationConfig);

    const cache = createCartCache();
    const view = createView();
    view.cart.id = "cart-id-2";

    await cache.set("user", "user-redis", "cart-redis", view);
    await expect(cache.get("user", "user-redis")).resolves.toEqual(view);
  });
});
