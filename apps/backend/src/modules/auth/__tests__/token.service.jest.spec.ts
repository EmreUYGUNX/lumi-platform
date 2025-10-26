import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { PrismaClient } from "@prisma/client";

import { hashPassword } from "@/lib/crypto/password.js";
import { UnauthorizedError } from "@/lib/errors.js";
// eslint-disable-next-line import/order -- import grouping follows Prettier sort order
import type { AuthConfig } from "@lumi/types";

import type { RbacService } from "../rbac.service.js";
import { SessionService } from "../session.service.js";
import type { TokenBlacklist } from "../token.blacklist.js";
import { TokenService } from "../token.service.js";

type TokenServiceUser = Parameters<TokenService["generateAccessToken"]>[0]["user"];
type TokenServiceSession = Parameters<TokenService["generateAccessToken"]>[0]["session"];

interface MockPrismaResult {
  prisma: PrismaClient;
  setSessionState: (data: Partial<TokenServiceSession>) => void;
}

const authConfig: AuthConfig = {
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

const createFixtures = async (baseNow: Date = new Date()) => {
  const user: TokenServiceUser = {
    id: "user_1",
    email: "user@example.com",
    status: "ACTIVE",
  };

  const session: TokenServiceSession = {
    id: "session_1",
    userId: user.id,
    refreshTokenHash: await hashPassword("placeholder-refresh-token"),
    expiresAt: new Date(baseNow.getTime() + authConfig.jwt.refresh.ttlSeconds * 1000),
    revokedAt: null, // eslint-disable-line unicorn/no-null -- Prisma schema stores null for active sessions
    fingerprint: null, // eslint-disable-line unicorn/no-null -- Prisma schema stores null for absent fingerprints
  };

  return { user, session };
};

const createMockPrisma = (
  user: TokenServiceUser,
  session: TokenServiceSession,
): MockPrismaResult => {
  let sessionState = structuredClone(session);
  const userState = structuredClone(user);

  const prismaMock = {
    userSession: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        if (where.id !== sessionState.id) {
          // eslint-disable-next-line unicorn/no-null -- Prisma client returns null when record is absent
          return null;
        }

        return { ...sessionState };
      }),
      update: jest.fn(
        async ({ where, data }: { where: { id: string }; data: Partial<TokenServiceSession> }) => {
          if (where.id !== sessionState.id) {
            throw new Error("Session not found");
          }

          sessionState = { ...sessionState, ...data };
          return { ...sessionState };
        },
      ),
      updateMany: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { expiresAt: { lt: Date }; revokedAt: null };
          data: Partial<TokenServiceSession>;
        }) => {
          const shouldUpdate =
            // eslint-disable-next-line unicorn/no-null -- Prisma schema uses null sentinel values
            sessionState.revokedAt === null &&
            sessionState.expiresAt.getTime() < where.expiresAt.lt.getTime();

          if (shouldUpdate) {
            sessionState = { ...sessionState, ...data };
            return { count: 1 };
          }

          return { count: 0 };
        },
      ),
    },
    user: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        if (where.id !== userState.id) {
          // eslint-disable-next-line unicorn/no-null -- Prisma client returns null when record is absent
          return null;
        }

        return { ...userState };
      }),
    },
  };

  return {
    prisma: prismaMock as unknown as PrismaClient,
    setSessionState: (data: Partial<TokenServiceSession>) => {
      sessionState = { ...sessionState, ...data };
    },
  };
};

const createStubBlacklist = (): TokenBlacklist => {
  const entries = new Map<string, Date>();

  return {
    async add(jti, expiresAt) {
      entries.set(jti, expiresAt);
    },
    async has(jti) {
      const expiresAt = entries.get(jti);
      return Boolean(expiresAt && expiresAt.getTime() > Date.now());
    },
    async remove(jti) {
      entries.delete(jti);
    },
    async cleanup() {
      entries.forEach((expiresAt, key) => {
        if (expiresAt.getTime() <= Date.now()) {
          entries.delete(key);
        }
      });
    },
    async shutdown() {
      entries.clear();
    },
  };
};

describe("TokenService", () => {
  let service: TokenService;
  let prisma: PrismaClient;
  let setSessionState: MockPrismaResult["setSessionState"];
  let userFixture: TokenServiceUser;
  let sessionFixture: TokenServiceSession;
  let blacklist: TokenBlacklist;
  let sessionService: SessionService;
  let rbacService: RbacService;
  let rbacMock: jest.Mocked<RbacService>;
  let currentNow: Date;
  const getNow = () => new Date(currentNow.getTime());

  const createRbacStub = (): RbacService => {
    const stub = {
      getUserRoles: jest.fn(async () => [{ id: "role_admin", name: "admin" }]),
      getUserPermissions: jest.fn(async () => ["manage:users"]),
      hasRole: jest.fn(async () => true),
      hasPermission: jest.fn(async () => true),
      invalidateUserPermissions: jest.fn(async () => {}),
      assignRole: jest.fn(async () => {}),
      revokeRole: jest.fn(async () => {}),
      grantPermission: jest.fn(async () => {}),
      revokePermission: jest.fn(async () => {}),
      shutdown: jest.fn(async () => {}),
    } as Partial<RbacService>;

    return stub as RbacService;
  };

  beforeEach(async () => {
    currentNow = new Date();
    const fixtures = await createFixtures(currentNow);
    userFixture = fixtures.user;
    sessionFixture = fixtures.session;
    blacklist = createStubBlacklist();

    const prismaResult = createMockPrisma(userFixture, sessionFixture);
    prisma = prismaResult.prisma;
    setSessionState = prismaResult.setSessionState;
    sessionService = new SessionService({
      prisma,
      authConfig,
      now: getNow,
    });
    rbacService = createRbacStub();
    rbacMock = rbacService as unknown as jest.Mocked<RbacService>;

    service = new TokenService({
      prisma,
      authConfig,
      blacklist,
      disableCleanupJob: true,
      sessionService,
      rbacService,
      now: getNow,
    });
  });

  it("generates access tokens containing RBAC claims", async () => {
    const accessToken = await service.generateAccessToken({
      user: userFixture,
      session: sessionFixture,
    });

    expect(typeof accessToken.token).toBe("string");
    expect(accessToken.payload.sub).toBe(userFixture.id);
    expect(accessToken.payload.roleIds).toContain("role_admin");
    expect(accessToken.payload.permissions).toContain("manage:users");
    expect(rbacMock.getUserRoles).toHaveBeenCalledWith("user_1");
    expect(rbacMock.getUserPermissions).toHaveBeenCalledWith("user_1");

    const decoded = await service.verifyAccessToken(accessToken.token);
    expect(decoded.sessionId).toBe(sessionFixture.id);
  });

  it("verifies refresh tokens and returns session context", async () => {
    const refreshToken = await service.generateRefreshToken({
      user: userFixture,
      session: sessionFixture,
    });

    setSessionState({ refreshTokenHash: await hashPassword(refreshToken.token) });

    const { payload, session } = await service.verifyRefreshToken(refreshToken.token);

    expect(payload.sub).toBe(userFixture.id);
    expect(session.id).toBe(sessionFixture.id);
  });

  it("rotates refresh tokens, revokes old token ID, and updates session state", async () => {
    const refreshToken = await service.generateRefreshToken({
      user: userFixture,
      session: sessionFixture,
    });

    setSessionState({ refreshTokenHash: await hashPassword(refreshToken.token) });

    const rotation = await service.rotateRefreshToken(refreshToken.token);

    expect(rotation.accessToken.payload.sub).toBe(userFixture.id);
    expect(rotation.refreshToken.payload.jti).not.toBe(refreshToken.payload.jti);

    const isBlacklisted = await blacklist.has(refreshToken.payload.jti);
    expect(isBlacklisted).toBe(true);

    await expect(service.verifyRefreshToken(refreshToken.token)).rejects.toThrow(UnauthorizedError);
  });

  it("revokeToken marks session as revoked", async () => {
    await service.revokeToken(sessionFixture.id, "test_revocation");

    const accessToken = await service.generateAccessToken({
      user: userFixture,
      session: sessionFixture,
    });

    await expect(service.verifyAccessToken(accessToken.token)).rejects.toThrow(UnauthorizedError);
  });

  it("rejects expired access and refresh tokens", async () => {
    const dateNowSpy = jest.spyOn(Date, "now").mockImplementation(() => currentNow.getTime());
    try {
      currentNow = new Date("2025-02-01T00:00:00.000Z");

      const refreshedExpiry = new Date(
        currentNow.getTime() + authConfig.jwt.refresh.ttlSeconds * 1000,
      );
      setSessionState({
        expiresAt: refreshedExpiry,
        revokedAt: null, // eslint-disable-line unicorn/no-null -- Prisma schema stores null for active sessions
      });
      sessionFixture = {
        ...sessionFixture,
        expiresAt: refreshedExpiry,
        revokedAt: null, // eslint-disable-line unicorn/no-null -- Prisma schema stores null for active sessions
      };

      const accessToken = await service.generateAccessToken({
        user: userFixture,
        session: sessionFixture,
      });
      const refreshToken = await service.generateRefreshToken({
        user: userFixture,
        session: sessionFixture,
      });

      const accessExpirySeconds = authConfig.jwt.access.ttlSeconds + 5;
      currentNow = new Date(currentNow.getTime() + accessExpirySeconds * 1000);

      await expect(service.verifyAccessToken(accessToken.token)).rejects.toMatchObject({
        details: expect.objectContaining({ reason: "access_token_expired" }),
      });

      const refreshExpirySeconds = authConfig.jwt.refresh.ttlSeconds + 5;
      currentNow = new Date(currentNow.getTime() + refreshExpirySeconds * 1000);

      await expect(service.verifyRefreshToken(refreshToken.token)).rejects.toMatchObject({
        details: expect.objectContaining({ reason: "refresh_token_expired" }),
      });
    } finally {
      dateNowSpy.mockRestore();
    }
  });

  it("detects refresh token reuse and blacklists the compromised token", async () => {
    const refreshToken = await service.generateRefreshToken({
      user: userFixture,
      session: sessionFixture,
    });

    const prismaMock = prisma as unknown as {
      userSession: {
        update: jest.Mock;
        updateMany: jest.Mock;
      };
    };

    await expect(service.verifyRefreshToken(refreshToken.token)).rejects.toMatchObject({
      details: expect.objectContaining({ reason: "token_reuse_detected" }),
    });

    expect(prismaMock.userSession.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: sessionFixture.id } }),
    );
    expect(prismaMock.userSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: sessionFixture.userId }),
      }),
    );

    await expect(blacklist.has(refreshToken.payload.jti)).resolves.toBe(true);

    await expect(
      sessionService.validateSession({
        sessionId: sessionFixture.id,
        expectedUserId: userFixture.id,
      }),
    ).rejects.toMatchObject({
      details: expect.objectContaining({ reason: "session_revoked" }),
    });
  });
});
