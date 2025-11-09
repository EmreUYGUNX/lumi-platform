import { describe, expect, it } from "@jest/globals";

import { ALL_PERMISSIONS, PERMISSIONS, isPermissionKey } from "../permissions.js";

describe("permissions catalog", () => {
  it("maintains a unique list of permission keys", () => {
    const flattened = ALL_PERMISSIONS;
    expect(flattened.length).toBeGreaterThan(0);
    expect(new Set(flattened).size).toBe(flattened.length);
    expect(flattened).toEqual(
      expect.arrayContaining([
        PERMISSIONS.PRODUCTS.READ,
        PERMISSIONS.ORDERS.REFUND,
        PERMISSIONS.USERS.DELETE,
      ]),
    );
  });

  it("exposes a type guard for permission keys", () => {
    expect(isPermissionKey(PERMISSIONS.PRODUCTS.WRITE)).toBe(true);
    expect(isPermissionKey("products:update")).toBe(false);
    expect(isPermissionKey(42)).toBe(false);
  });
});
