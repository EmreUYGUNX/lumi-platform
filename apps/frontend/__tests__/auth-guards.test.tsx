import { describe, expect, it, beforeEach } from "vitest";

import { hasPermission, hasRole } from "@/lib/auth/guards";
import { sessionStore } from "@/store/session";

describe("auth guards", () => {
  beforeEach(() => {
    sessionStore.getState().clearSession();
    sessionStore.getState().setSession({
      user: {
        id: "user-1",
        email: "demo@lumi.com",
        roles: ["admin", "staff"],
        permissions: ["products:write", "orders:read"],
        emailVerified: true,
        status: "ACTIVE",
        firstName: "Demo",
        lastName: "User",
      } as never,
    });
  });

  it("checks role availability", () => {
    expect(hasRole("admin")).toBe(true);
    expect(hasRole("customer")).toBe(false);
  });

  it("checks permission availability", () => {
    expect(hasPermission("products:write")).toBe(true);
    expect(hasPermission("analytics:read")).toBe(false);
  });
});
