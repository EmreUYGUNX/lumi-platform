import { randomUUID } from "node:crypto";

import type {
  Permission,
  PrismaClient,
  Role,
  User,
  UserPermission,
  UserRole,
  UserSession,
} from "@prisma/client";
import jwt, { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";

// eslint-disable-next-line import/order -- import grouping follows Prettier sort order
import type { AuthConfig } from "@lumi/types";

import { getAuthConfig } from "@/config/index.js";
import { hashPassword, verifyPassword } from "@/lib/crypto/password.js";
import { UnauthorizedError } from "@/lib/errors.js";
import { type LogMetadata, createChildLogger, logError } from "@/lib/logger.js";
import { getPrismaClient } from "@/lib/prisma.js";

import { type TokenBlacklist, createTokenBlacklist } from "./token.blacklist.js";
import type {
  AccessTokenClaims,
  AuthenticatedRole,
  AuthenticatedUser,
  GeneratedToken,
  RefreshTokenClaims,
  RequestAuthState,
  TokenPair,
  VerifiedRefreshToken,
} from "./token.types.js";

const DEFAULT_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const CLEANUP_JOB_NAME = "auth:token.cleanup";
const TOKEN_LOGGER_COMPONENT = "auth:token-service";
const DEFAULT_BLACKLIST_METADATA: LogMetadata = {
  component: TOKEN_LOGGER_COMPONENT,
};

type UserWithAuthRelations = Pick<User, "id" | "email" | "status"> & {
  roles?: (UserRole & { role?: Role | null })[];
  permissions?: (UserPermission & { permission?: Permission | null })[];
};

type SessionWithSecurity = Pick<
  UserSession,
  "id" | "userId" | "expiresAt" | "revokedAt" | "refreshTokenHash" | "fingerprint"
>;

export interface GenerateAccessTokenInput {
  user: UserWithAuthRelations;
  session: SessionWithSecurity;
}

export interface GenerateRefreshTokenInput {
  user: Pick<User, "id">;
  session: SessionWithSecurity;
}

interface RotateTokenResult extends TokenPair {
  session: SessionWithSecurity;
}

export interface TokenServiceOptions {
  prisma?: PrismaClient;
  blacklist?: TokenBlacklist;
  authConfig?: AuthConfig;
  logger?: ReturnType<typeof createChildLogger>;
  now?: () => Date;
  cleanupIntervalMs?: number;
  disableCleanupJob?: boolean;
}

const toUnixSeconds = (date: Date): number => Math.floor(date.getTime() / 1000);

const normaliseRoles = (user: UserWithAuthRelations): AuthenticatedRole[] => {
  const roles = user.roles ?? [];
  const roleIds = new Map<string, string>();

  roles.forEach((entry) => {
    const id = entry.role?.id ?? entry.roleId;
    const name = entry.role?.name ?? entry.roleId;
    if (id) {
      roleIds.set(id, name);
    }
  });

  return [...roleIds.entries()].map(([id, name]) => ({ id, name }));
};

const normalisePermissions = (user: UserWithAuthRelations): string[] => {
  const permissions = user.permissions ?? [];
  const keys = new Set<string>();

  permissions.forEach((entry) => {
    const key = entry.permission?.key ?? entry.permissionId;
    if (key) {
      keys.add(key);
    }
  });

  return [...keys];
};

const toGeneratedToken = <TPayload extends AccessTokenClaims | RefreshTokenClaims>(
  token: string,
  payload: TPayload,
  expiresAt: Date,
): GeneratedToken<TPayload> => ({
  token,
  payload,
  expiresAt,
});

const signToken = async <TPayload extends AccessTokenClaims | RefreshTokenClaims>(
  payload: TPayload,
  secret: string,
): Promise<string> =>
  new Promise((resolve, reject) => {
    jwt.sign(payload, secret, { algorithm: "HS256" }, (error, token) => {
      if (error || !token) {
        reject(error ?? new Error("Failed to sign JWT token"));
        return;
      }

      resolve(token);
    });
  });

const isAccessTokenClaims = (payload: unknown): payload is AccessTokenClaims => {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as Record<string, unknown>;

  return (
    typeof candidate.sub === "string" &&
    typeof candidate.email === "string" &&
    Array.isArray(candidate.roleIds) &&
    Array.isArray(candidate.permissions) &&
    typeof candidate.sessionId === "string" &&
    typeof candidate.jti === "string" &&
    typeof candidate.exp === "number" &&
    typeof candidate.iat === "number"
  );
};

const isRefreshTokenClaims = (payload: unknown): payload is RefreshTokenClaims => {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as Record<string, unknown>;

  return (
    typeof candidate.sub === "string" &&
    typeof candidate.sessionId === "string" &&
    typeof candidate.jti === "string" &&
    typeof candidate.exp === "number" &&
    typeof candidate.iat === "number"
  );
};

const buildAuthenticatedUser = (
  user: UserWithAuthRelations,
  accessToken: AccessTokenClaims,
): AuthenticatedUser => ({
  id: user.id,
  email: user.email,
  roles: normaliseRoles(user),
  permissions: normalisePermissions(user),
  sessionId: accessToken.sessionId,
  token: accessToken,
});

const createAuthState = (
  accessToken: AccessTokenClaims | undefined,
  overrides: Partial<RequestAuthState> = {},
): RequestAuthState => ({
  ...overrides,
  accessToken,
});

export class TokenService {
  private readonly prisma: PrismaClient;

  private readonly blacklist: TokenBlacklist;

  private readonly config: AuthConfig;

  private readonly logger: ReturnType<typeof createChildLogger>;

  private readonly now: () => Date;

  private cleanupTimer?: NodeJS.Timeout;

  private readonly cleanupInterval: number;

  constructor(options: TokenServiceOptions = {}) {
    this.prisma = options.prisma ?? getPrismaClient();
    this.config = options.authConfig ?? getAuthConfig();
    this.blacklist =
      options.blacklist ??
      createTokenBlacklist({
        metadata: DEFAULT_BLACKLIST_METADATA,
      });
    this.logger = options.logger ?? createChildLogger(TOKEN_LOGGER_COMPONENT);
    this.now = options.now ?? (() => new Date());
    this.cleanupInterval = options.cleanupIntervalMs ?? DEFAULT_CLEANUP_INTERVAL_MS;

    if (!options.disableCleanupJob) {
      this.startCleanupJob();
    }
  }

  private startCleanupJob() {
    if (this.cleanupTimer) {
      return;
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredSessions().catch((error: unknown) => {
        logError(error, "Token cleanup job failed", { job: CLEANUP_JOB_NAME });
      });
    }, this.cleanupInterval);

    this.cleanupTimer.unref?.();
    this.logger.debug("Token cleanup job scheduled", {
      job: CLEANUP_JOB_NAME,
      intervalMs: this.cleanupInterval,
    });
  }

  private stopCleanupJob() {
    if (!this.cleanupTimer) {
      return;
    }

    clearInterval(this.cleanupTimer);
    this.cleanupTimer = undefined;
  }

  private computeAccessTokenExpiry(): Date {
    const {
      jwt: {
        access: { ttlSeconds },
      },
    } = this.config;
    return new Date(this.now().getTime() + ttlSeconds * 1000);
  }

  private computeRefreshTokenExpiry(): Date {
    const {
      jwt: {
        refresh: { ttlSeconds },
      },
    } = this.config;
    return new Date(this.now().getTime() + ttlSeconds * 1000);
  }

  private buildAccessTokenPayload(
    user: UserWithAuthRelations,
    session: SessionWithSecurity,
    jti: string,
    expiresAt: Date,
  ): AccessTokenClaims {
    return {
      sub: user.id,
      email: user.email,
      roleIds: normaliseRoles(user).map((role) => role.id),
      permissions: normalisePermissions(user),
      sessionId: session.id,
      jti,
      iat: toUnixSeconds(this.now()),
      exp: toUnixSeconds(expiresAt),
    };
  }

  private buildRefreshTokenPayload(
    user: Pick<User, "id">,
    session: SessionWithSecurity,
    jti: string,
    expiresAt: Date,
  ): RefreshTokenClaims {
    return {
      sub: user.id,
      sessionId: session.id,
      jti,
      iat: toUnixSeconds(this.now()),
      exp: toUnixSeconds(expiresAt),
    };
  }

  async generateAccessToken({
    user,
    session,
  }: GenerateAccessTokenInput): Promise<GeneratedToken<AccessTokenClaims>> {
    const expiresAt = this.computeAccessTokenExpiry();
    const jti = randomUUID();
    const payload = this.buildAccessTokenPayload(user, session, jti, expiresAt);
    const token = await signToken(payload, this.config.jwt.access.secret);

    return toGeneratedToken(token, payload, expiresAt);
  }

  async generateRefreshToken({
    user,
    session,
  }: GenerateRefreshTokenInput): Promise<GeneratedToken<RefreshTokenClaims>> {
    const expiresAt = this.computeRefreshTokenExpiry();
    const jti = randomUUID();
    const payload = this.buildRefreshTokenPayload(user, session, jti, expiresAt);
    const token = await signToken(payload, this.config.jwt.refresh.secret);

    return toGeneratedToken(token, payload, expiresAt);
  }

  private decodeAccessToken(token: string): AccessTokenClaims {
    try {
      const payload = jwt.verify(token, this.config.jwt.access.secret, {
        algorithms: ["HS256"],
      });

      if (!isAccessTokenClaims(payload)) {
        throw new UnauthorizedError("Access token payload is malformed.", {
          details: { reason: "malformed_access_token" },
        });
      }

      return payload;
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        throw new UnauthorizedError("Access token expired.", {
          details: { reason: "access_token_expired" },
        });
      }

      if (error instanceof JsonWebTokenError) {
        throw new UnauthorizedError("Invalid access token.", {
          details: { reason: "invalid_access_token" },
        });
      }

      throw error;
    }
  }

  private decodeRefreshToken(token: string): RefreshTokenClaims {
    try {
      const payload = jwt.verify(token, this.config.jwt.refresh.secret, {
        algorithms: ["HS256"],
      });

      if (!isRefreshTokenClaims(payload)) {
        throw new UnauthorizedError("Refresh token payload is malformed.", {
          details: { reason: "malformed_refresh_token" },
        });
      }

      return payload;
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        throw new UnauthorizedError("Refresh token expired.", {
          details: { reason: "refresh_token_expired" },
        });
      }

      if (error instanceof JsonWebTokenError) {
        throw new UnauthorizedError("Invalid refresh token.", {
          details: { reason: "invalid_refresh_token" },
        });
      }

      throw error;
    }
  }

  private async ensureBlacklistAllows(jti: string, tokenType: "access" | "refresh"): Promise<void> {
    const isBlacklisted = await this.blacklist.has(jti);
    if (isBlacklisted) {
      throw new UnauthorizedError(`${tokenType} token has been revoked.`, {
        details: { reason: `${tokenType}_token_revoked`, tokenId: jti },
      });
    }
  }

  private async fetchSession(sessionId: string): Promise<SessionWithSecurity | null> {
    return this.prisma.userSession.findUnique({
      where: { id: sessionId },
    }) as Promise<SessionWithSecurity | null>;
  }

  private async assertSessionActive(
    session: SessionWithSecurity | null,
    expectedUserId: string,
  ): Promise<SessionWithSecurity> {
    if (!session) {
      throw new UnauthorizedError("Authentication session could not be found.", {
        details: { reason: "session_not_found" },
      });
    }

    if (session.userId !== expectedUserId) {
      throw new UnauthorizedError("Authentication session does not belong to this user.", {
        details: { reason: "session_user_mismatch" },
      });
    }

    if (session.revokedAt) {
      throw new UnauthorizedError("Authentication session has been revoked.", {
        details: { reason: "session_revoked" },
      });
    }

    if (session.expiresAt.getTime() <= this.now().getTime()) {
      await this.prisma.userSession.update({
        where: { id: session.id },
        data: { revokedAt: this.now() },
      });

      throw new UnauthorizedError("Authentication session has expired.", {
        details: { reason: "session_expired" },
      });
    }

    return session;
  }

  async verifyAccessToken(token: string): Promise<AccessTokenClaims> {
    const payload = this.decodeAccessToken(token);
    await this.ensureBlacklistAllows(payload.jti, "access");

    const session = await this.fetchSession(payload.sessionId);
    await this.assertSessionActive(session, payload.sub);

    return payload;
  }

  private async compareRefreshTokenHash(
    token: string,
    session: SessionWithSecurity,
    tokenId: string,
    expirySeconds: number,
  ): Promise<void> {
    const matches = await verifyPassword(token, session.refreshTokenHash);
    if (matches) {
      return;
    }

    await this.revokeToken(session.id, "refresh_token_hash_mismatch");
    await this.blacklist.add(tokenId, new Date(expirySeconds * 1000));

    throw new UnauthorizedError("Refresh token reuse detected.", {
      details: { reason: "token_reuse_detected" },
    });
  }

  async verifyRefreshToken(token: string): Promise<VerifiedRefreshToken> {
    const payload = this.decodeRefreshToken(token);
    await this.ensureBlacklistAllows(payload.jti, "refresh");

    const session = await this.fetchSession(payload.sessionId);
    const activeSession = await this.assertSessionActive(session, payload.sub);
    await this.compareRefreshTokenHash(token, activeSession, payload.jti, payload.exp);

    return {
      payload,
      session: activeSession,
    };
  }

  async revokeToken(sessionId: string, reason = "manual_revocation"): Promise<void> {
    const session = await this.prisma.userSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      this.logger.warn("Attempted to revoke session that does not exist", {
        sessionId,
        reason,
      });
      return;
    }

    if (session.revokedAt) {
      this.logger.debug("Session already revoked", { sessionId, reason });
      return;
    }

    await this.prisma.userSession.update({
      where: { id: sessionId },
      data: { revokedAt: this.now() },
    });

    this.logger.info("Authentication session revoked", {
      sessionId,
      userId: session.userId,
      reason,
    });
  }

  private async loadUser(userId: string): Promise<UserWithAuthRelations> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: { include: { role: true } },
        permissions: { include: { permission: true } },
      },
    });

    if (!user) {
      throw new UnauthorizedError("User associated with token could not be found.", {
        details: { reason: "user_not_found" },
      });
    }

    if (user.status !== "ACTIVE") {
      throw new UnauthorizedError("User account is not active.", {
        details: { reason: "user_inactive" },
      });
    }

    return user;
  }

  async rotateRefreshToken(oldRefreshToken: string): Promise<RotateTokenResult> {
    const verification = await this.verifyRefreshToken(oldRefreshToken);
    const { payload, session } = verification;

    const user = await this.loadUser(payload.sub);
    const [newRefreshToken, newAccessToken] = await Promise.all([
      this.generateRefreshToken({ user, session }),
      this.generateAccessToken({ user, session }),
    ]);

    await this.blacklist.add(payload.jti, new Date(payload.exp * 1000));

    await this.prisma.userSession.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: await hashPassword(newRefreshToken.token),
        expiresAt: newRefreshToken.expiresAt,
        // eslint-disable-next-line unicorn/no-null -- Prisma field requires explicit null to mark active session
        revokedAt: null,
      },
    });

    this.logger.info("Refresh token rotated", {
      sessionId: session.id,
      userId: session.userId,
      previousTokenId: payload.jti,
      nextTokenId: newRefreshToken.payload.jti,
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      session,
    };
  }

  async fetchAuthenticatedUser(accessToken: AccessTokenClaims): Promise<AuthenticatedUser> {
    const user = await this.loadUser(accessToken.sub);
    return buildAuthenticatedUser(user, accessToken);
  }

  // eslint-disable-next-line class-methods-use-this -- Exposed for middleware helper composition
  createRequestAuthState(
    accessToken: AccessTokenClaims | undefined,
    options: Partial<RequestAuthState> = {},
  ): RequestAuthState {
    return createAuthState(accessToken, options);
  }

  private async cleanupExpiredSessions(): Promise<void> {
    const now = this.now();
    const result = await this.prisma.userSession.updateMany({
      where: {
        expiresAt: { lt: now },
        // eslint-disable-next-line unicorn/no-null -- Prisma schema uses null sentinel values
        revokedAt: null,
      },
      data: { revokedAt: now },
    });

    if (result.count > 0) {
      this.logger.info("Revoked expired authentication sessions", {
        count: result.count,
        job: CLEANUP_JOB_NAME,
      });
    }

    await this.blacklist.cleanup();
  }

  async shutdown(): Promise<void> {
    this.stopCleanupJob();
    await this.blacklist.shutdown();
  }
}

export const createTokenService = (options: TokenServiceOptions = {}): TokenService =>
  new TokenService(options);
