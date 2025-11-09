import { afterEach, describe, expect, it, jest } from "@jest/globals";

import { createCartCache } from "../cart.cache.js";
import type { CartSummaryView } from "../cart.types.js";

const sampleView = {
  cart: {
    id: "cart-1",
    items: [],
    totals: {
      subtotal: { amount: "0.00", currency: "TRY" },
      discounts: { amount: "0.00", currency: "TRY" },
      taxes: { amount: "0.00", currency: "TRY" },
      total: { amount: "0.00", currency: "TRY" },
    },
    meta: {},
  },
  stock: {
    status: "ok",
    issues: [],
    checkedAt: new Date("2024-01-01T00:00:00Z").toISOString(),
  },
  delivery: {
    status: "standard",
    minHours: 24,
    maxHours: 72,
    message: "Standard delivery",
  },
} as unknown as CartSummaryView;

describe("InMemoryCartCache", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("expires stale entries and prunes the cart index", async () => {
    const cache = createCartCache();
    let currentTime = 0;
    const nowSpy = jest.spyOn(Date, "now").mockImplementation(() => currentTime);

    await cache.set("user", "user-1", "cart-1", sampleView);
    expect(await cache.get("user", "user-1")).toEqual(sampleView);

    // Advance beyond ttl to force cleanup.
    currentTime = 65_000;
    expect(await cache.get("user", "user-1")).toBeUndefined();

    nowSpy.mockRestore();
  });

  it("handles invalidation calls for missing keys without erroring", async () => {
    const cache = createCartCache();

    await expect(cache.invalidate("user", "missing")).resolves.toBeUndefined();
    await expect(cache.invalidateByCartId("unknown")).resolves.toBeUndefined();
  });

  it("removes all scoped entries when invalidating by cart id", async () => {
    const cache = createCartCache();
    await cache.set("user", "user-1", "cart-1", sampleView);
    await cache.set("session", "session-1", "cart-1", sampleView);

    await cache.invalidateByCartId("cart-1");

    expect(await cache.get("user", "user-1")).toBeUndefined();
    expect(await cache.get("session", "session-1")).toBeUndefined();
  });
});
