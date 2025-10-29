import { randomUUID } from "node:crypto";

import type { PrismaClient, User, UserSession } from "@prisma/client";
import jwt from "jsonwebtoken";

import { getAuthConfig } from "@/config/index.js";
import { hashPassword, verifyPassword } from "@/lib/crypto/password.js";
import { UnauthorizedError } from "@/lib/errors.js";
import { type LogMetadata, createChildLogger, logError } from "@/lib/logger.js";
import { getPrismaClient } from "@/lib/prisma.js";
// eslint-disable-next-line import/order -- import grouping follows Prettier sort order
import type { AuthConfig } from "@lumi/types";

import { type RbacService, createRbacService, getSharedRbacService } from "./rbac.service.js";
import { SessionService } from "./session.service.js";
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

const { JsonWebTokenError, TokenExpiredError } = jwt;

const DEFAULT_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const CLEANUP_JOB_NAME = "auth:token.cleanup";
const TOKEN_LOGGER_COMPONENT = "auth:token-service";
const DEFAULT_BLACKLIST_METADATA: LogMetadata = {
  component: TOKEN_LOGGER_COMPONENT,
};

type UserRecord = Pick<User, "id" | "email" | "status">;

type SessionWithSecurity = Pick<
  UserSession,
  "id" | "userId" | "expiresAt" | "revokedAt" | "refreshTokenHash" | "fingerprint"
>;

export interface GenerateAccessTokenInput {
  user: UserRecord;
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
  sessionService?: SessionService;
  rbacService?: RbacService;
}

const toUnixSeconds = (date: Date): number => Math.floor(date.getTime() / 1000);

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
  user: UserRecord,
  accessToken: AccessTokenClaims,
  roles: AuthenticatedRole[],
  permissions: string[],
): AuthenticatedUser => ({
  id: user.id,
  email: user.email,
  roles,
  permissions,
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

  private readonly sessionService: SessionService;

  private readonly rbacService: RbacService;

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
    this.sessionService =
      options.sessionService ??
      new SessionService({
        prisma: this.prisma,
        authConfig: this.config,
        now: this.now,
      });
    if (options.rbacService) {
      this.rbacService = options.rbacService;
    } else if (options.prisma) {
      this.rbacService = createRbacService({
        prisma: this.prisma,
        logger: createChildLogger(`${TOKEN_LOGGER_COMPONENT}:rbac`),
      });
    } else {
      this.rbacService = getSharedRbacService();
    }
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
    user: UserRecord,
    session: SessionWithSecurity,
    roles: AuthenticatedRole[],
    permissions: string[],
    jti: string,
    expiresAt: Date,
  ): AccessTokenClaims {
    return {
      sub: user.id,
      email: user.email,
      roleIds: roles.map((role) => role.id),
      permissions,
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
    const [roles, permissions] = await Promise.all([
      this.rbacService.getUserRoles(user.id),
      this.rbacService.getUserPermissions(user.id),
    ]);
    const payload = this.buildAccessTokenPayload(user, session, roles, permissions, jti, expiresAt);
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

  async verifyAccessToken(token: string): Promise<AccessTokenClaims> {
    const payload = this.decodeAccessToken(token);
    await this.ensureBlacklistAllows(payload.jti, "access");

    await this.sessionService.validateSession({
      sessionId: payload.sessionId,
      expectedUserId: payload.sub,
    });

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
    const revokedCount = await this.sessionService.revokeAllUserSessions(
      session.userId,
      "refresh_token_replay_detected",
    );
    await this.blacklist.add(tokenId, new Date(expirySeconds * 1000));

    throw new UnauthorizedError("Refresh token reuse detected.", {
      details: {
        reason: "token_reuse_detected",
        userId: session.userId,
        sessionId: session.id,
        revokedCount,
      },
    });
  }

  async verifyRefreshToken(token: string): Promise<VerifiedRefreshToken> {
    const payload = this.decodeRefreshToken(token);
    await this.ensureBlacklistAllows(payload.jti, "refresh");

    const activeSession = await this.sessionService.validateSession({
      sessionId: payload.sessionId,
      expectedUserId: payload.sub,
    });
    await this.compareRefreshTokenHash(token, activeSession, payload.jti, payload.exp);

    return {
      payload,
      session: activeSession,
    };
  }

  async revokeToken(sessionId: string, reason = "manual_revocation"): Promise<void> {
    await this.sessionService.revokeSession(sessionId, reason);
  }

  private async loadUser(userId: string): Promise<UserRecord> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        status: true,
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
    const [roles, permissions] = await Promise.all([
      this.rbacService.getUserRoles(user.id),
      this.rbacService.getUserPermissions(user.id),
    ]);

    return buildAuthenticatedUser(user, accessToken, roles, permissions);
  }

  // eslint-disable-next-line class-methods-use-this -- Exposed for middleware helper composition
  createRequestAuthState(
    accessToken: AccessTokenClaims | undefined,
    options: Partial<RequestAuthState> = {},
  ): RequestAuthState {
    return createAuthState(accessToken, options);
  }

  private async cleanupExpiredSessions(): Promise<void> {
    const revokedCount = await this.sessionService.cleanupExpiredSessions();

    if (revokedCount > 0) {
      this.logger.info("Revoked expired authentication sessions", {
        count: revokedCount,
        job: CLEANUP_JOB_NAME,
      });
    }

    await this.blacklist.cleanup();
  }

  async shutdown(): Promise<void> {
    this.stopCleanupJob();
    await this.blacklist.shutdown();
    await this.rbacService.shutdown();
  }
}

export const createTokenService = (options: TokenServiceOptions = {}): TokenService =>
  new TokenService(options);
