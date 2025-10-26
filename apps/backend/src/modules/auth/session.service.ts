import { randomUUID } from "node:crypto";

import { type PrismaClient, type UserSession } from "@prisma/client";

import { getAuthConfig } from "@/config/index.js";
import { type FingerprintComponents, createDeviceFingerprint } from "@/lib/crypto/fingerprint.js";
import { hashPassword, timingSafeStringCompare } from "@/lib/crypto/password.js";
import { UnauthorizedError } from "@/lib/errors.js";
import { createChildLogger } from "@/lib/logger.js";
import { getPrismaClient } from "@/lib/prisma.js";

type SessionAuthConfig = ReturnType<typeof getAuthConfig>;

export type SessionDeviceMetadata = FingerprintComponents;

const SESSION_LOGGER_COMPONENT = "auth:session-service";

export interface FingerprintMismatchContext {
  session: UserSession;
  expectedFingerprint: string;
  device?: SessionDeviceMetadata;
}

export interface SessionRevocationContext {
  sessionId: string;
  userId: string;
  reason: string;
  revokedAt: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface SessionSecurityNotifier {
  handleFingerprintMismatch?(context: FingerprintMismatchContext): Promise<void> | void;
  handleSessionRevoked?(context: SessionRevocationContext): Promise<void> | void;
}

export interface CreateSessionInput {
  userId: string;
  refreshToken: string;
  sessionId?: string;
  expiresAt?: Date;
  device?: SessionDeviceMetadata;
}

export interface ValidateSessionInput {
  sessionId: string;
  expectedUserId?: string;
  expectedFingerprint?: string;
  device?: SessionDeviceMetadata;
}

export interface SessionServiceOptions {
  prisma?: PrismaClient;
  authConfig?: SessionAuthConfig;
  logger?: ReturnType<typeof createChildLogger>;
  now?: () => Date;
  notifier?: SessionSecurityNotifier;
}

export class SessionService {
  private readonly prisma: PrismaClient;

  private readonly config: SessionAuthConfig;

  private readonly logger: ReturnType<typeof createChildLogger>;

  private readonly now: () => Date;

  private readonly notifier?: SessionSecurityNotifier;

  constructor(options: SessionServiceOptions = {}) {
    this.prisma = options.prisma ?? getPrismaClient();
    this.config = options.authConfig ?? getAuthConfig();
    this.logger = options.logger ?? createChildLogger(SESSION_LOGGER_COMPONENT);
    this.now = options.now ?? (() => new Date());
    this.notifier = options.notifier;
  }

  private computeExpiry(expiresAt?: Date): Date {
    if (expiresAt) {
      return expiresAt;
    }

    const seconds = this.config.jwt.refresh.ttlSeconds;
    return new Date(this.now().getTime() + seconds * 1000);
  }

  private computeFingerprint(device?: SessionDeviceMetadata): string | undefined {
    if (!device) {
      return undefined;
    }

    return createDeviceFingerprint({
      ...device,
      secret: this.config.session.fingerprintSecret,
    });
  }

  async createSession(input: CreateSessionInput): Promise<UserSession> {
    const id = input.sessionId ?? randomUUID();
    const expiresAt = this.computeExpiry(input.expiresAt);
    const refreshTokenHash = await hashPassword(input.refreshToken);
    const fingerprint = this.computeFingerprint(input.device);

    const session = await this.prisma.userSession.create({
      data: {
        id,
        userId: input.userId,
        refreshTokenHash,
        fingerprint,
        ipAddress: input.device?.ipAddress ?? undefined,
        userAgent: input.device?.userAgent ?? undefined,
        expiresAt,
      },
    });

    this.logger.info("Created authentication session", {
      sessionId: session.id,
      userId: session.userId,
      hasFingerprint: Boolean(fingerprint),
      expiresAt: session.expiresAt.toISOString(),
    });

    return session;
  }

  async validateSession(input: ValidateSessionInput): Promise<UserSession> {
    const session = await this.prisma.userSession.findUnique({
      where: { id: input.sessionId },
    });

    if (!session) {
      throw new UnauthorizedError("Authentication session could not be found.", {
        details: { reason: "session_not_found" },
      });
    }

    if (input.expectedUserId && session.userId !== input.expectedUserId) {
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

    const storedFingerprint = session.fingerprint;
    const expectedFingerprint =
      input.expectedFingerprint ??
      (input.device ? this.computeFingerprint(input.device) : undefined);

    if (storedFingerprint && expectedFingerprint) {
      const matches = timingSafeStringCompare(storedFingerprint, expectedFingerprint);

      if (!matches) {
        await this.handleFingerprintMismatch(session, expectedFingerprint, input.device);

        throw new UnauthorizedError("Authentication session fingerprint mismatch detected.", {
          details: { reason: "session_fingerprint_mismatch" },
        });
      }
    }

    return session;
  }

  async revokeSession(sessionId: string, reason = "manual_revocation"): Promise<void> {
    const session = await this.prisma.userSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      this.logger.warn("Attempted to revoke session that does not exist", { sessionId, reason });
      return;
    }

    if (session.revokedAt) {
      this.logger.debug("Authentication session already revoked", { sessionId, reason });
      return;
    }

    const revokedAt = this.now();
    await this.prisma.userSession.update({
      where: { id: sessionId },
      data: { revokedAt },
    });

    this.logger.info("Authentication session revoked", {
      sessionId,
      userId: session.userId,
      revokedAt: revokedAt.toISOString(),
      reason,
    });

    await this.notifier?.handleSessionRevoked?.({
      sessionId,
      userId: session.userId,
      reason,
      revokedAt,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
    });
  }

  async revokeAllUserSessions(userId: string, reason = "bulk_revocation"): Promise<number> {
    const result = await this.prisma.userSession.updateMany({
      where: {
        userId,
        // eslint-disable-next-line unicorn/no-null -- Prisma schema stores null for active sessions
        revokedAt: null,
      },
      data: { revokedAt: this.now() },
    });

    if (result.count > 0) {
      this.logger.info("Revoked active sessions for user", { userId, count: result.count, reason });
    } else {
      this.logger.debug("No active sessions found for user", { userId, reason });
    }

    return result.count;
  }

  async cleanupExpiredSessions(): Promise<number> {
    const now = this.now();
    const result = await this.prisma.userSession.updateMany({
      where: {
        expiresAt: { lt: now },
        // eslint-disable-next-line unicorn/no-null -- Prisma schema stores null for active sessions
        revokedAt: null,
      },
      data: { revokedAt: now },
    });

    return result.count;
  }

  private async handleFingerprintMismatch(
    session: UserSession,
    expectedFingerprint: string,
    device?: SessionDeviceMetadata,
  ): Promise<void> {
    await this.revokeSession(session.id, "fingerprint_mismatch");

    this.logger.warn("Session fingerprint mismatch detected", {
      sessionId: session.id,
      userId: session.userId,
      ipAddress: device?.ipAddress,
      userAgent: device?.userAgent,
    });

    await this.notifier?.handleFingerprintMismatch?.({
      session,
      expectedFingerprint,
      device,
    });
  }
}

export const createSessionService = (options: SessionServiceOptions = {}): SessionService =>
  new SessionService(options);
