type LumiUserRole = "customer" | "merchant" | "staff" | "admin";

export interface LumiUser {
  id: string;
  name: string;
  email: string;
  roles: LumiUserRole[];
  tier: "starter" | "growth" | "enterprise";
  avatarUrl?: string;
}

const mockUser: LumiUser = {
  id: "user_mock_001",
  name: "Leyla Işık",
  email: "leyla@lumi.com",
  roles: ["merchant", "admin"],
  tier: "enterprise",
  avatarUrl: "https://www.gravatar.com/avatar/?d=identicon",
};

export const shouldEnforceGuards = process.env.NEXT_PUBLIC_REQUIRE_AUTH_GUARDS === "true";
const enablePreviewUser = process.env.NEXT_PUBLIC_ENABLE_MOCK_USER !== "false";

/**
 * In Phase 6 we do not yet have a real authentication bridge between
 * the backend and frontend. This helper provides a deterministic mock
 * user so that route groups remain accessible while we build the UX.
 * Set NEXT_PUBLIC_REQUIRE_AUTH_GUARDS=true once the auth orchestration
 * phase connects the actual session APIs.
 */
export async function getCurrentUser(options?: {
  /**
   * When false, preview users are suppressed so logged-out experiences remain testable.
   */
  allowPreviewUser?: boolean;
}): Promise<LumiUser | undefined> {
  if (enablePreviewUser && options?.allowPreviewUser !== false) {
    return mockUser;
  }
  return undefined;
}

export function hasRole(user: LumiUser | undefined, role: LumiUserRole): boolean {
  return user?.roles.includes(role) ?? false;
}

export function resolvePreviewUser(): LumiUser {
  return mockUser;
}
