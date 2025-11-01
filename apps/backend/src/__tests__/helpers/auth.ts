import type {
  AccessTokenClaims,
  AuthenticatedRole,
  AuthenticatedUser,
} from "@/modules/auth/token.types.js";

const DEFAULT_ROLE: AuthenticatedRole = { id: "role_user", name: "user" };

const DEFAULT_TOKEN: AccessTokenClaims = {
  sub: "user-1",
  email: "user@example.com",
  roleIds: [DEFAULT_ROLE.id],
  permissions: [],
  sessionId: "session-1",
  jti: "token-1",
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
};

const normaliseRoles = (
  roles: AuthenticatedRole[] | undefined,
  tokenOverride: Partial<AccessTokenClaims> | undefined,
): AuthenticatedRole[] => {
  if (roles && roles.length > 0) {
    return roles;
  }

  if (tokenOverride?.roleIds && tokenOverride.roleIds.length > 0) {
    return tokenOverride.roleIds.map((id) => ({ id, name: id }));
  }

  return [DEFAULT_ROLE];
};

export const createAuthenticatedUser = (
  overrides: Partial<AuthenticatedUser> = {},
): AuthenticatedUser => {
  const tokenOverride: Partial<AccessTokenClaims> = overrides.token ? { ...overrides.token } : {};
  const roles = normaliseRoles(overrides.roles, tokenOverride);
  const permissions =
    overrides.permissions ?? tokenOverride.permissions ?? DEFAULT_TOKEN.permissions;

  const token: AccessTokenClaims = {
    ...DEFAULT_TOKEN,
    ...tokenOverride,
    sub: overrides.id ?? tokenOverride.sub ?? DEFAULT_TOKEN.sub,
    email: overrides.email ?? tokenOverride.email ?? DEFAULT_TOKEN.email,
    roleIds: tokenOverride.roleIds ?? roles.map((role) => role.id),
    permissions,
    sessionId: overrides.sessionId ?? tokenOverride.sessionId ?? DEFAULT_TOKEN.sessionId,
  };

  return {
    id: overrides.id ?? token.sub,
    email: overrides.email ?? token.email,
    roles,
    permissions,
    sessionId: overrides.sessionId ?? token.sessionId,
    token,
  };
};
