import type { JwtPayload } from "jsonwebtoken";

export interface AccessTokenClaims extends JwtPayload {
  sub: string;
  email: string;
  roleIds: string[];
  permissions: string[];
  sessionId: string;
  jti: string;
  iat: number;
  exp: number;
}

export interface RefreshTokenClaims extends JwtPayload {
  sub: string;
  sessionId: string;
  jti: string;
  iat: number;
  exp: number;
}

export interface GeneratedToken<TPayload extends JwtPayload> {
  token: string;
  payload: TPayload;
  expiresAt: Date;
}

export interface TokenPair {
  accessToken: GeneratedToken<AccessTokenClaims>;
  refreshToken: GeneratedToken<RefreshTokenClaims>;
}

export interface AuthenticatedRole {
  id: string;
  name: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  roles: AuthenticatedRole[];
  permissions: string[];
  sessionId: string;
  token: AccessTokenClaims;
}

export interface RequestAuthState {
  accessToken?: AccessTokenClaims;
  refreshToken?: string;
  refreshTokenPresent?: boolean;
  accessTokenExpired?: boolean;
  error?: {
    reason: string;
    message: string;
  };
}

export interface VerifiedRefreshToken {
  payload: RefreshTokenClaims;
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
    revokedAt: Date | null;
    refreshTokenHash: string;
    fingerprint: string | null;
  };
}
