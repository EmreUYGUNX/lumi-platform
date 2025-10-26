import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { type PrismaClient, type UserSession } from "@prisma/client";

import * as ConfigModule from "@/config/index.js";
import { createDeviceFingerprint } from "@/lib/crypto/fingerprint.js";
import { verifyPassword } from "@/lib/crypto/password.js";
import { UnauthorizedError } from "@/lib/errors.js";
import * as PrismaModule from "@/lib/prisma.js";

import {
  type FingerprintMismatchContext,
  type SessionDeviceMetadata,
  type SessionRevocationContext,
  type SessionSecurityNotifier,
  SessionService,
  type SessionServiceOptions,
  createSessionService,
} from "../session.service.js";

type SessionAuthConfig = NonNullable<SessionServiceOptions["authConfig"]>;

type MutableUserSession = UserSession;

interface MockPrismaContext {
  prisma: PrismaClient;
  getSession: (id: string) => MutableUserSession | undefined;
  setNow: (value: Date) => void;
  createSessionRecord: (session: MutableUserSession) => void;
}

const createMockPrisma = (): MockPrismaContext => {
  const sessions = new Map<string, MutableUserSession>();
  let currentNow = new Date();

  const getNow = () => new Date(currentNow.getTime());

  const prismaMock = {
    userSession: {
      create: jest.fn(async ({ data }: { data: Partial<UserSession> }) => {
        const record: MutableUserSession = {
          id: data.id as string,
          userId: data.userId as string,
          refreshTokenHash: data.refreshTokenHash as string,
          fingerprint: (data.fingerprint ?? null) as string | null, // eslint-disable-line unicorn/no-null -- Prisma mock uses null sentinel for missing fingerprint
          ipAddress: (data.ipAddress ?? null) as string | null, // eslint-disable-line unicorn/no-null -- Prisma mock uses null sentinel for missing IP
          userAgent: (data.userAgent ?? null) as string | null, // eslint-disable-line unicorn/no-null -- Prisma mock uses null sentinel for missing user agent
          expiresAt: data.expiresAt as Date,
          // eslint-disable-next-line unicorn/no-null -- Prisma schema stores null for active sessions
          revokedAt: null,
          createdAt: getNow(),
          updatedAt: getNow(),
        };

        sessions.set(record.id, record);

        return structuredClone(record);
      }),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        const record = sessions.get(where.id);
        // eslint-disable-next-line unicorn/no-null -- Prisma client returns null when the record is absent
        return record ? structuredClone(record) : null;
      }),
      update: jest.fn(
        async ({ where, data }: { where: { id: string }; data: Partial<UserSession> }) => {
          const record = sessions.get(where.id);
          if (!record) {
            throw new Error("Session not found");
          }

          const updated: MutableUserSession = {
            ...record,
            ...data,
            updatedAt: getNow(),
          };

          sessions.set(where.id, updated);

          return structuredClone(updated);
        },
      ),
      updateMany: jest.fn(
        async ({
          where,
          data,
        }: {
          where: {
            userId?: string;
            expiresAt?: { lt: Date };
            revokedAt?: null;
          };
          data: Partial<UserSession>;
        }) => {
          let count = 0;

          sessions.forEach((record, id) => {
            const matchesUser = where.userId ? record.userId === where.userId : true;
            const matchesRevocation = where.revokedAt === null ? record.revokedAt === null : true;
            const matchesExpiry =
              where.expiresAt?.lt instanceof Date
                ? record.expiresAt.getTime() < where.expiresAt.lt.getTime()
                : true;

            if (matchesUser && matchesRevocation && matchesExpiry) {
              const updated: MutableUserSession = {
                ...record,
                ...data,
                updatedAt: getNow(),
              };
              sessions.set(id, updated);
              count += 1;
            }
          });

          return { count };
        },
      ),
    },
  };

  return {
    prisma: prismaMock as unknown as PrismaClient,
    getSession: (id: string) => sessions.get(id),
    setNow: (value: Date) => {
      currentNow = value;
    },
    createSessionRecord: (session: MutableUserSession) => {
      sessions.set(session.id, structuredClone(session));
    },
  };
};

const authConfig: SessionAuthConfig = {
  jwt: {
    access: {
      secret: "access-secret-placeholder-32-characters!!",
      ttlSeconds: 900,
    },
    refresh: {
      secret: "refresh-secret-placeholder-32-characters!!",
      ttlSeconds: 14 * 24 * 60 * 60,
    },
  },
  cookies: {
    secret: "cookie-secret-placeholder-32-characters!!",
  },
  tokens: {
    emailVerification: {
      ttlSeconds: 24 * 60 * 60,
    },
    passwordReset: {
      ttlSeconds: 60 * 60,
    },
  },
  session: {
    fingerprintSecret: "fingerprint-secret-placeholder-32!!",
    lockoutDurationSeconds: 900,
    maxLoginAttempts: 5,
  },
  bruteForce: {
    enabled: true,
    windowSeconds: 900,
    progressiveDelays: {
      baseDelayMs: 250,
      stepDelayMs: 250,
      maxDelayMs: 5000,
    },
    captchaThreshold: 10,
  },
};

const DEVICE_METADATA: SessionDeviceMetadata = {
  ipAddress: "203.0.113.10",
  userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
  accept: "text/html,application/xhtml+xml",
};

describe("SessionService", () => {
  let prismaContext: MockPrismaContext;
  let service: SessionService;
  let notifier: SessionSecurityNotifier;
  let now: Date;

  beforeEach(() => {
    prismaContext = createMockPrisma();
    now = new Date("2025-01-01T00:00:00.000Z");
    prismaContext.setNow(now);
    const handleFingerprintMismatch = jest.fn((_: FingerprintMismatchContext) => {});
    const handleSessionRevoked = jest.fn((_: SessionRevocationContext) => {});

    notifier = {
      handleFingerprintMismatch,
      handleSessionRevoked,
    };

    service = new SessionService({
      prisma: prismaContext.prisma,
      authConfig,
      now: () => now,
      notifier,
    });
  });

  it("creates a new session with hashed refresh token and fingerprint", async () => {
    const session = await service.createSession({
      userId: "user_1",
      refreshToken: "plain-refresh-token",
      device: DEVICE_METADATA,
    });

    expect(session.userId).toBe("user_1");
    expect(session.refreshTokenHash).not.toBe("plain-refresh-token");
    expect(await verifyPassword("plain-refresh-token", session.refreshTokenHash)).toBe(true);
    expect(session.fingerprint).toBe(
      createDeviceFingerprint({ ...DEVICE_METADATA, secret: authConfig.session.fingerprintSecret }),
    );
    expect(session.ipAddress).toBe(DEVICE_METADATA.ipAddress);
    expect(session.userAgent).toBe(DEVICE_METADATA.userAgent);
  });

  it("creates a session without device metadata when fingerprinting data is absent", async () => {
    const session = await service.createSession({
      userId: "user_1_no_device",
      refreshToken: "plain-refresh-token-nodevice",
    });

    expect(session.fingerprint).toBeNull();
    expect(session.ipAddress).toBeNull();
    expect(session.userAgent).toBeNull();
  });

  it("validates an active session", async () => {
    const created = await service.createSession({
      userId: "user_2",
      refreshToken: "refresh-token",
      device: DEVICE_METADATA,
    });

    const validated = await service.validateSession({
      sessionId: created.id,
      expectedUserId: "user_2",
      device: DEVICE_METADATA,
    });

    expect(validated.id).toBe(created.id);
  });

  it("throws when session cannot be located", async () => {
    await expect(
      service.validateSession({ sessionId: "missing-session", expectedUserId: "user_missing" }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("throws when session belongs to a different user", async () => {
    const created = await service.createSession({
      userId: "user_original",
      refreshToken: "refresh-token-original",
      device: DEVICE_METADATA,
    });

    await expect(
      service.validateSession({
        sessionId: created.id,
        expectedUserId: "user_other",
      }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("throws when validating an expired session and marks it revoked", async () => {
    const created = await service.createSession({
      userId: "user_3",
      refreshToken: "refresh-token",
      device: DEVICE_METADATA,
    });

    now = new Date(created.expiresAt.getTime() + 1);
    prismaContext.setNow(now);

    await expect(
      service.validateSession({
        sessionId: created.id,
        expectedUserId: "user_3",
      }),
    ).rejects.toThrow(UnauthorizedError);

    const stored = prismaContext.getSession(created.id);
    expect(stored?.revokedAt).toBeInstanceOf(Date);
  });

  it("revokes session on fingerprint mismatch and notifies handler", async () => {
    const created = await service.createSession({
      userId: "user_4",
      refreshToken: "refresh-token",
      device: DEVICE_METADATA,
    });

    const mismatchedDevice: SessionDeviceMetadata = {
      ...DEVICE_METADATA,
      userAgent: "Different Agent/1.0",
    };

    await expect(
      service.validateSession({
        sessionId: created.id,
        expectedUserId: "user_4",
        device: mismatchedDevice,
      }),
    ).rejects.toThrow(UnauthorizedError);

    expect(notifier.handleFingerprintMismatch).toHaveBeenCalledTimes(1);

    const stored = prismaContext.getSession(created.id);
    expect(stored?.revokedAt).toBeInstanceOf(Date);
  });

  it("throws when session has been manually revoked", async () => {
    const created = await service.createSession({
      userId: "user_revoked",
      refreshToken: "refresh-token-revoked",
      device: DEVICE_METADATA,
    });

    prismaContext.createSessionRecord({ ...created, revokedAt: new Date(now.getTime()) });

    await expect(
      service.validateSession({ sessionId: created.id, expectedUserId: "user_revoked" }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("revokes all active sessions for a user", async () => {
    const first = await service.createSession({
      userId: "user_5",
      refreshToken: "refresh-token-1",
      device: DEVICE_METADATA,
    });
    await service.createSession({
      userId: "user_5",
      refreshToken: "refresh-token-2",
      device: { ...DEVICE_METADATA, userAgent: "Mozilla/5.0" },
      sessionId: "custom-session-id",
    });

    const count = await service.revokeAllUserSessions("user_5", "password_reset");

    expect(count).toBe(2);
    expect(prismaContext.getSession(first.id)?.revokedAt).toBeInstanceOf(Date);
    expect(prismaContext.getSession("custom-session-id")?.revokedAt).toBeInstanceOf(Date);
  });

  it("returns zero when trying to revoke sessions for a user without active sessions", async () => {
    const count = await service.revokeAllUserSessions("user_without_sessions", "audit");

    expect(count).toBe(0);
  });

  it("handles revocation attempts for non-existent sessions gracefully", async () => {
    await expect(service.revokeSession("missing-session", "unit_test")).resolves.toBeUndefined();
  });

  it("skips revocation when session is already revoked", async () => {
    const created = await service.createSession({
      userId: "user_already_revoked",
      refreshToken: "refresh-token-already",
      device: DEVICE_METADATA,
    });

    prismaContext.createSessionRecord({ ...created, revokedAt: new Date(now.getTime()) });

    await expect(service.revokeSession(created.id, "already_revoked")).resolves.toBeUndefined();
  });

  it("cleans up expired sessions and returns revoked count", async () => {
    const active = await service.createSession({
      userId: "user_6",
      refreshToken: "active-refresh",
      device: DEVICE_METADATA,
    });

    const expiredSession: MutableUserSession = {
      ...active,
      id: "expired-session",
      userId: "user_7",
      refreshTokenHash: active.refreshTokenHash,
      expiresAt: new Date(now.getTime() - 1000),
      // eslint-disable-next-line unicorn/no-null -- Prisma schema stores null for active sessions
      revokedAt: null,
    };
    prismaContext.createSessionRecord(expiredSession);

    const revoked = await service.cleanupExpiredSessions();

    expect(revoked).toBeGreaterThanOrEqual(1);
    expect(prismaContext.getSession("expired-session")?.revokedAt).toBeInstanceOf(Date);
    expect(prismaContext.getSession(active.id)?.revokedAt).toBeNull();
  });

  it("notifies handler when session is revoked explicitly", async () => {
    const created = await service.createSession({
      userId: "user_8",
      refreshToken: "refresh-token",
      device: DEVICE_METADATA,
    });

    await service.revokeSession(created.id, "manual_test");

    expect(notifier.handleSessionRevoked).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: created.id,
        userId: "user_8",
        reason: "manual_test",
        revokedAt: now,
        ipAddress: DEVICE_METADATA.ipAddress,
        userAgent: DEVICE_METADATA.userAgent,
      }),
    );
  });

  it("creates a SessionService instance through the factory helper", () => {
    const factoryService = createSessionService({
      prisma: prismaContext.prisma,
      authConfig,
      notifier,
      now: () => now,
    });

    expect(factoryService).toBeInstanceOf(SessionService);
  });

  it("falls back to default dependencies when options are omitted", async () => {
    const prismaSpy = jest
      .spyOn(PrismaModule, "getPrismaClient")
      .mockReturnValue(prismaContext.prisma as unknown as PrismaClient);
    const authConfigSpy = jest.spyOn(ConfigModule, "getAuthConfig").mockReturnValue(authConfig);

    const serviceWithDefaults = new SessionService({ notifier });
    await expect(
      serviceWithDefaults.createSession({
        userId: "user_defaults",
        refreshToken: "refresh-token-default",
      }),
    ).resolves.toBeDefined();

    expect(prismaSpy).toHaveBeenCalled();
    expect(authConfigSpy).toHaveBeenCalled();

    prismaSpy.mockRestore();
    authConfigSpy.mockRestore();
  });
});
