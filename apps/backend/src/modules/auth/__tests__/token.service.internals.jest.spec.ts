import { describe, expect, it } from "@jest/globals";

import { tokenServiceInternals } from "../token.service.js";
import type { AccessTokenClaims, RefreshTokenClaims } from "../token.types.js";

describe("token.service internals", () => {
  const baseAccessToken: AccessTokenClaims = {
    sub: "user_1",
    email: "user@example.com",
    roleIds: ["role_admin"],
    permissions: ["catalog:write"],
    sessionId: "sess_1",
    jti: "token_1",
    iat: 1,
    exp: 2,
  };

  const baseRefreshToken: RefreshTokenClaims = {
    sub: "user_1",
    sessionId: "sess_1",
    jti: "refresh_1",
    iat: 1,
    exp: 2,
  };

  it("validates access token claims", () => {
    expect(tokenServiceInternals.isAccessTokenClaims(baseAccessToken)).toBe(true);
    expect(
      tokenServiceInternals.isAccessTokenClaims({
        ...baseAccessToken,
        permissions: "invalid",
      }),
    ).toBe(false);
  });

  it("validates refresh token claims", () => {
    expect(tokenServiceInternals.isRefreshTokenClaims(baseRefreshToken)).toBe(true);
    expect(
      tokenServiceInternals.isRefreshTokenClaims({
        ...baseRefreshToken,
        sessionId: undefined,
      }),
    ).toBe(false);
  });

  it("creates request auth state snapshots", () => {
    const state = tokenServiceInternals.createAuthState(baseAccessToken, {
      refreshTokenPresent: true,
      error: { reason: "expired", message: "Token expired" },
    });

    expect(state.accessToken).toBe(baseAccessToken);
    expect(state.refreshTokenPresent).toBe(true);
    expect(state.error?.reason).toBe("expired");
  });

  it("normalises generated tokens", () => {
    const generated = tokenServiceInternals.toGeneratedToken(
      "token-value",
      baseAccessToken,
      new Date(0),
    );
    expect(generated.token).toBe("token-value");
    expect(generated.payload).toBe(baseAccessToken);
    expect(generated.expiresAt.toISOString()).toBe(new Date(0).toISOString());
  });
});
