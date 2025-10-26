import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { PrismaClient, User } from "@prisma/client";

import { createDeviceFingerprint } from "@/lib/crypto/fingerprint.js";
import type { EmailService } from "@/lib/email/email.service.js";
import type { createChildLogger } from "@/lib/logger.js";
import { createTestConfig } from "@/testing/config.js";
import type { ApplicationConfig } from "@lumi/types";

import { AuthService } from "../auth.service.js";
import type { AuthRequestContext, AuthUserProfile } from "../auth.service.js";
import type { RbacService } from "../rbac.service.js";
import type { SecurityEventService } from "../security-event.service.js";
import type { SessionDeviceMetadata, SessionService } from "../session.service.js";
import type { TokenService } from "../token.service.js";

/* eslint-disable unicorn/no-null -- Test fixtures intentionally exercise null database states. */

jest.mock("@/lib/crypto/fingerprint.js", () => ({
  createDeviceFingerprint: jest.fn(),
}));

const mockedCreateDeviceFingerprint = jest.mocked(createDeviceFingerprint);

const fixedNow = new Date("2025-01-01T00:00:00.000Z");

type LoggerStub = ReturnType<typeof createChildLogger>;

interface InternalAuthService {
  buildUserProfile: (userId: string) => Promise<AuthUserProfile>;
  assertTokenActive: (
    record: { consumedAt: Date | null; expiresAt: Date },
    scope: "email_verification" | "password_reset",
  ) => void;
  assertFingerprintMatches: (fingerprint: string | null, device: SessionDeviceMetadata) => void;
  refreshLockoutState: (user: User) => Promise<User>;
  handleFailedLogin: (user: User, context: AuthRequestContext) => Promise<void>;
  getLockoutRemainingSeconds: (lockoutUntil?: Date | null) => number;
}

const createConfig = (): ApplicationConfig =>
  createTestConfig({
    app: {
      environment: "test",
      apiBaseUrl: "https://api.example.com",
      frontendUrl: "https://app.example.com",
      port: 3000,
    },
    auth: {
      session: {
        fingerprintSecret: "fingerprint-secret",
        lockoutDurationSeconds: 900,
        maxLoginAttempts: 5,
      },
      cookies: {
        domain: "example.com",
        secret: "cookie-secret",
      },
      jwt: {
        access: {
          secret: "access-secret",
          ttlSeconds: 900,
        },
        refresh: {
          secret: "refresh-secret",
          ttlSeconds: 1_209_600,
        },
      },
      tokens: {
        emailVerification: { ttlSeconds: 86_400 },
        passwordReset: { ttlSeconds: 3600 },
      },
    },
  });

interface PrismaMock {
  user: {
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  userSession: {
    findFirst: jest.MockedFunction<
      (args?: Record<string, unknown>) => Promise<{ id: string } | null>
    >;
    findMany: jest.MockedFunction<(args?: Record<string, unknown>) => Promise<{ id: string }[]>>;
  };
}

const createPrismaMock = (): PrismaMock =>
  ({
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    userSession: {
      findFirst: jest.fn(async () => null) as PrismaMock["userSession"]["findFirst"],
      findMany: jest.fn(async () => []) as PrismaMock["userSession"]["findMany"],
    },
  }) as unknown as PrismaMock;

const createRbacServiceMock = (): RbacService =>
  ({
    getUserRoles: jest.fn(async () => [{ id: "role_admin", name: "admin" }]),
    getUserPermissions: jest.fn(async () => ["manage:users"]),
    hasRole: jest.fn(),
    hasPermission: jest.fn(),
    invalidateUserPermissions: jest.fn(),
    assignRole: jest.fn(),
    revokeRole: jest.fn(),
    grantPermission: jest.fn(),
    revokePermission: jest.fn(),
    shutdown: jest.fn(),
  }) as unknown as RbacService;

const createSessionServiceMock = (): SessionService =>
  ({
    revokeAllUserSessions: jest.fn(),
    revokeSession: jest.fn(),
    createSession: jest.fn(),
  }) as unknown as SessionService;

const createTokenServiceMock = (): jest.Mocked<TokenService> => {
  const refreshExpires = new Date(fixedNow.getTime() + 14 * 24 * 60 * 60 * 1000);
  const accessExpires = new Date(fixedNow.getTime() + 15 * 60 * 1000);

  const defaultRefreshToken = {
    token: "refresh-token",
    expiresAt: refreshExpires,
    payload: {
      sub: "user_default",
      sessionId: "session_default",
      jti: "refresh_default",
      exp: Math.floor(refreshExpires.getTime() / 1000),
      iat: Math.floor(fixedNow.getTime() / 1000),
    },
  };

  const defaultAccessToken = {
    token: "access-token",
    expiresAt: accessExpires,
    payload: {
      sub: "user_default",
      email: "default@example.com",
      roleIds: [],
      permissions: [],
      sessionId: "session_default",
      jti: "access_default",
      exp: Math.floor(accessExpires.getTime() / 1000),
      iat: Math.floor(fixedNow.getTime() / 1000),
    },
  };

  const tokenService: jest.Mocked<TokenService> = {
    verifyRefreshToken: jest.fn(),
    rotateRefreshToken: jest.fn(),
    revokeToken: jest.fn(),
    generateAccessToken: jest.fn(),
    generateRefreshToken: jest.fn(),
  } as unknown as jest.Mocked<TokenService>;

  tokenService.generateAccessToken.mockResolvedValue(defaultAccessToken);
  tokenService.generateRefreshToken.mockResolvedValue(defaultRefreshToken);

  return tokenService;
};

const createEmailServiceMock = (): EmailService =>
  ({
    sendWelcomeEmail: jest.fn(),
    sendVerificationEmail: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
    sendPasswordChangedNotification: jest.fn(),
    sendAccountLockoutNotification: jest.fn(),
    sendNewDeviceLoginAlert: jest.fn(),
    sendSessionRevokedNotification: jest.fn(),
    sendTwoFactorSetupEmail: jest.fn(),
    sendSecurityAlertEmail: jest.fn(),
  }) as unknown as EmailService;

const createSecurityEventsMock = (): SecurityEventService =>
  ({
    log: jest.fn(),
  }) as unknown as SecurityEventService;

const createAuthService = (
  overrides: Partial<ConstructorParameters<typeof AuthService>[0]> = {},
) => {
  const prisma = overrides.prisma ?? (createPrismaMock() as unknown as PrismaClient);
  const rbacService = overrides.rbacService ?? createRbacServiceMock();
  return {
    prisma,
    service: new AuthService({
      prisma: prisma as unknown as PrismaClient,
      config: createConfig(),
      tokenService: overrides.tokenService ?? createTokenServiceMock(),
      sessionService: overrides.sessionService ?? createSessionServiceMock(),
      rbacService,
      emailService: overrides.emailService ?? createEmailServiceMock(),
      securityEventService: overrides.securityEventService ?? createSecurityEventsMock(),
      logger:
        overrides.logger ??
        ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() } as unknown as LoggerStub),
      now: () => fixedNow,
    }),
    rbacService,
  };
};

describe("AuthService internal helpers", () => {
  beforeEach(() => {
    mockedCreateDeviceFingerprint.mockReset();
  });

  describe("buildUserProfile", () => {
    it("returns mapped profile with roles and permissions", async () => {
      const prisma = createPrismaMock();
      const findUniqueMock = prisma.user.findUnique as jest.Mock;
      findUniqueMock.mockImplementation(async () => ({
        id: "user_123",
        email: "user@example.com",
        firstName: "Ada",
        lastName: "Lovelace",
        phone: "+905551112233",
        emailVerified: true,
        status: "ACTIVE",
      }));
      const { service, rbacService } = createAuthService({
        prisma: prisma as unknown as PrismaClient,
      });
      const internal = service as unknown as InternalAuthService;
      const profile = await internal.buildUserProfile("user_123");

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: "user_123" },
        select: expect.any(Object),
      });
      expect(rbacService.getUserRoles).toHaveBeenCalledWith("user_123");
      expect(rbacService.getUserPermissions).toHaveBeenCalledWith("user_123");
      expect(profile).toEqual(
        expect.objectContaining({
          id: "user_123",
          email: "user@example.com",
          roles: ["admin"],
          permissions: ["manage:users"],
        }),
      );
    });

    it("throws when user is missing", async () => {
      const prisma = createPrismaMock();
      const findUniqueMock = prisma.user.findUnique as jest.Mock;
      findUniqueMock.mockImplementation(async () => {});
      const { service } = createAuthService({ prisma: prisma as unknown as PrismaClient });
      const internal = service as unknown as InternalAuthService;

      await expect(internal.buildUserProfile("missing")).rejects.toThrowError("User not found.");
    });
  });

  describe("refreshLockoutState", () => {
    it("resets expired lockouts and clears counters", async () => {
      const prisma = createPrismaMock();
      const securityEvents = createSecurityEventsMock();
      const emailService = createEmailServiceMock();
      const { service } = createAuthService({
        prisma: prisma as unknown as PrismaClient,
        securityEventService: securityEvents,
        emailService,
      });
      const internal = service as unknown as InternalAuthService;

      const lockedUser = {
        id: "user_locked",
        email: "locked@example.com",
        passwordHash: "hash",
        firstName: "Locked",
        lastName: "User",
        phone: null,
        emailVerified: false,
        emailVerifiedAt: null,
        failedLoginCount: 5,
        lockoutUntil: new Date(fixedNow.getTime() - 60 * 1000),
        twoFactorSecret: null,
        twoFactorEnabled: false,
        status: "ACTIVE",
        createdAt: fixedNow,
        updatedAt: fixedNow,
      } as unknown as User;

      const result = await internal.refreshLockoutState(lockedUser);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user_locked" },
        data: {
          failedLoginCount: 0,
          lockoutUntil: null,
        },
      });
      expect(result.failedLoginCount).toBe(0);
      expect(result.lockoutUntil).toBeNull();
    });

    it("returns user unchanged when lockout is still active", async () => {
      const { service } = createAuthService();
      const internal = service as unknown as InternalAuthService;
      const futureLockout = new Date(fixedNow.getTime() + 5 * 60 * 1000);
      const user = {
        id: "user_lock",
        email: "lock@example.com",
        passwordHash: "hash",
        firstName: "Lock",
        lastName: "User",
        phone: null,
        emailVerified: false,
        emailVerifiedAt: null,
        failedLoginCount: 5,
        lockoutUntil: futureLockout,
        twoFactorSecret: null,
        twoFactorEnabled: false,
        status: "ACTIVE",
        createdAt: fixedNow,
        updatedAt: fixedNow,
      } as unknown as User;

      const result = await internal.refreshLockoutState(user);
      expect(result.lockoutUntil).toBe(futureLockout);
    });
  });

  describe("handleFailedLogin", () => {
    it("logs lockout events and dispatches notification when threshold reached", async () => {
      const prisma = createPrismaMock();
      const securityEvents = createSecurityEventsMock();
      const emailService = createEmailServiceMock();
      const { service } = createAuthService({
        prisma: prisma as unknown as PrismaClient,
        securityEventService: securityEvents,
        emailService,
      });
      const internal = service as unknown as InternalAuthService;

      const user = {
        id: "user_lock",
        email: "lock@example.com",
        passwordHash: "hash",
        firstName: "Lock",
        lastName: "User",
        phone: null,
        emailVerified: false,
        emailVerifiedAt: null,
        failedLoginCount: 4,
        lockoutUntil: null,
        twoFactorSecret: null,
        twoFactorEnabled: false,
        status: "ACTIVE",
        createdAt: fixedNow,
        updatedAt: fixedNow,
      } as unknown as User;

      const context: AuthRequestContext = {
        device: {
          ipAddress: "203.0.113.10",
          userAgent: "UnitTest/1.0",
          accept: "application/json",
        },
      };

      await internal.handleFailedLogin(user, context);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user_lock" },
        data: {
          failedLoginCount: { increment: 1 },
          lockoutUntil: expect.any(Date),
        },
      });

      expect(securityEvents.log).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "login_failed",
          userId: "user_lock",
        }),
      );

      expect(securityEvents.log).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "account_locked",
          userId: "user_lock",
        }),
      );

      expect(emailService.sendAccountLockoutNotification).toHaveBeenCalledWith({
        to: "lock@example.com",
        firstName: "Lock",
        unlockAt: expect.any(Date),
      });
    });
  });

  describe("getLockoutRemainingSeconds", () => {
    it("calculates remaining seconds for a future lockout", () => {
      const { service } = createAuthService();
      const internal = service as unknown as InternalAuthService;
      const future = new Date(fixedNow.getTime() + 2 * 60 * 1000);
      const remaining = internal.getLockoutRemainingSeconds(future);
      expect(remaining).toBeGreaterThan(0);
    });
  });

  describe("assertTokenActive", () => {
    it("throws when token has already been consumed", () => {
      const { service } = createAuthService();
      const internal = service as unknown as InternalAuthService;
      const record = {
        consumedAt: new Date("2024-12-31T23:59:59.000Z"),
        expiresAt: new Date("2025-01-02T00:00:00.000Z"),
      };

      expect(() => internal.assertTokenActive(record, "email_verification")).toThrowError(
        "Token has already been used.",
      );
    });

    it("throws when token has expired", () => {
      const { service } = createAuthService();
      const internal = service as unknown as InternalAuthService;
      const record = {
        // eslint-disable-next-line unicorn/no-null -- Prisma stores null for unconsumed tokens
        consumedAt: null,
        expiresAt: new Date("2024-12-31T23:59:59.000Z"),
      };

      expect(() => internal.assertTokenActive(record, "password_reset")).toThrowError(
        "Token has expired.",
      );
    });

    it("passes for active tokens", () => {
      const { service } = createAuthService();
      const internal = service as unknown as InternalAuthService;
      const record = {
        // eslint-disable-next-line unicorn/no-null -- Prisma stores null for unconsumed tokens
        consumedAt: null,
        expiresAt: new Date("2025-01-02T00:00:00.000Z"),
      };

      expect(() => internal.assertTokenActive(record, "password_reset")).not.toThrow();
    });
  });

  describe("assertFingerprintMatches", () => {
    it("returns when stored fingerprint is missing", () => {
      const { service } = createAuthService();
      const internal = service as unknown as InternalAuthService;

      expect(() =>
        // eslint-disable-next-line unicorn/no-null -- Prisma stores null when no fingerprint exists
        internal.assertFingerprintMatches(null, { ipAddress: "203.0.113.1" }),
      ).not.toThrow();
    });

    it("throws when fingerprint does not match expected value", () => {
      mockedCreateDeviceFingerprint.mockReturnValue("calculated");
      const { service } = createAuthService();
      const internal = service as unknown as InternalAuthService;

      expect(() =>
        internal.assertFingerprintMatches("stored", {
          ipAddress: "203.0.113.1",
          userAgent: "JestAgent",
        }),
      ).toThrowError("Authentication session fingerprint mismatch detected.");
    });

    it("accepts matching fingerprints", () => {
      mockedCreateDeviceFingerprint.mockReturnValue("stored");
      const { service } = createAuthService();
      const internal = service as unknown as InternalAuthService;

      expect(() =>
        internal.assertFingerprintMatches("stored", {
          ipAddress: "203.0.113.1",
          userAgent: "JestAgent",
        }),
      ).not.toThrow();
      expect(mockedCreateDeviceFingerprint).toHaveBeenCalledWith(
        expect.objectContaining({
          secret: "fingerprint-secret",
        }),
      );
    });
  });

  describe("issueSessionAndTokens", () => {
    it("marks device as new when fingerprint has not been seen", async () => {
      const prisma = createPrismaMock();
      const sessionService = createSessionServiceMock();
      const refreshExpiry = new Date(fixedNow.getTime() + 30 * 60 * 1000);
      const accessExpiry = new Date(fixedNow.getTime() + 15 * 60 * 1000);
      const tokenService = createTokenServiceMock();

      tokenService.generateRefreshToken.mockResolvedValue({
        token: "refresh-token",
        expiresAt: refreshExpiry,
        payload: {
          sub: "user_issue",
          sessionId: "session_new",
          jti: "refresh_jti",
          exp: Math.floor(refreshExpiry.getTime() / 1000),
          iat: Math.floor(fixedNow.getTime() / 1000),
        },
      });
      tokenService.generateAccessToken.mockResolvedValue({
        token: "access-token",
        expiresAt: accessExpiry,
        payload: {
          sub: "user_issue",
          email: "device@example.com",
          roleIds: [],
          permissions: [],
          sessionId: "session_new",
          jti: "access_jti",
          exp: Math.floor(accessExpiry.getTime() / 1000),
          iat: Math.floor(fixedNow.getTime() / 1000),
        },
      });

      (prisma.userSession.findFirst as PrismaMock["userSession"]["findFirst"]).mockResolvedValue(
        null,
      );
      mockedCreateDeviceFingerprint.mockReturnValue("fingerprint-new");

      const { service } = createAuthService({
        prisma: prisma as unknown as PrismaClient,
        sessionService,
        tokenService,
      });

      const internal = service as unknown as {
        issueSessionAndTokens: (
          user: User,
          device: SessionDeviceMetadata,
        ) => Promise<{ newDevice: boolean; sessionId: string }>;
      };

      const result = await internal.issueSessionAndTokens(
        {
          id: "user_issue",
          email: "device@example.com",
          passwordHash: "hash",
          firstName: "Device",
          lastName: "User",
          phone: null,
          emailVerified: true,
          emailVerifiedAt: fixedNow,
          failedLoginCount: 0,
          lockoutUntil: null,
          twoFactorSecret: null,
          twoFactorEnabled: false,
          status: "ACTIVE",
          createdAt: fixedNow,
          updatedAt: fixedNow,
        } as unknown as User,
        {
          ipAddress: "203.0.113.55",
          userAgent: "UnitTest/1.0",
          accept: "application/json",
        },
      );

      expect(result.newDevice).toBe(true);
      expect(prisma.userSession.findFirst).toHaveBeenCalledWith({
        where: {
          userId: "user_issue",
          fingerprint: "fingerprint-new",
        },
        select: { id: true },
      });
      expect(sessionService.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: result.sessionId,
          userId: "user_issue",
          refreshToken: "refresh-token",
        }),
      );
    });

    it("recognises existing devices when fingerprint matches", async () => {
      const prisma = createPrismaMock();
      (prisma.userSession.findFirst as PrismaMock["userSession"]["findFirst"]).mockResolvedValue({
        id: "existing",
      });
      const sessionService = createSessionServiceMock();
      const tokenService = createTokenServiceMock();

      tokenService.generateRefreshToken.mockResolvedValue({
        token: "refresh-token",
        expiresAt: fixedNow,
        payload: {
          sub: "user_issue",
          sessionId: "session_existing",
          jti: "refresh_jti",
          exp: Math.floor(fixedNow.getTime() / 1000),
          iat: Math.floor(fixedNow.getTime() / 1000),
        },
      });
      tokenService.generateAccessToken.mockResolvedValue({
        token: "access-token",
        expiresAt: fixedNow,
        payload: {
          sub: "user_issue",
          email: "device@example.com",
          roleIds: [],
          permissions: [],
          sessionId: "session_existing",
          jti: "access_jti",
          exp: Math.floor(fixedNow.getTime() / 1000),
          iat: Math.floor(fixedNow.getTime() / 1000),
        },
      });

      mockedCreateDeviceFingerprint.mockReturnValue("fingerprint-existing");

      const { service } = createAuthService({
        prisma: prisma as unknown as PrismaClient,
        sessionService,
        tokenService,
      });

      const internal = service as unknown as {
        issueSessionAndTokens: (
          user: User,
          device: SessionDeviceMetadata,
        ) => Promise<{ newDevice: boolean }>;
      };

      const result = await internal.issueSessionAndTokens(
        {
          id: "user_issue",
          email: "device@example.com",
          passwordHash: "hash",
          firstName: "Device",
          lastName: "User",
          phone: null,
          emailVerified: true,
          emailVerifiedAt: fixedNow,
          failedLoginCount: 0,
          lockoutUntil: null,
          twoFactorSecret: null,
          twoFactorEnabled: false,
          status: "ACTIVE",
          createdAt: fixedNow,
          updatedAt: fixedNow,
        } as unknown as User,
        {
          ipAddress: "203.0.113.55",
          userAgent: "UnitTest/1.0",
          accept: "application/json",
        },
      );

      expect(result.newDevice).toBe(false);
    });
  });

  describe("notifyNewDeviceLogin", () => {
    it("sends formatted new device alert email", async () => {
      const emailService = createEmailServiceMock();
      const { service } = createAuthService({ emailService });

      await (
        service as unknown as {
          notifyNewDeviceLogin: (user: User, device: SessionDeviceMetadata) => Promise<void>;
        }
      ).notifyNewDeviceLogin(
        {
          id: "user_email",
          email: "notify@example.com",
          passwordHash: "hash",
          firstName: "Notify",
          lastName: "User",
          phone: null,
          emailVerified: true,
          emailVerifiedAt: fixedNow,
          failedLoginCount: 0,
          lockoutUntil: null,
          twoFactorSecret: null,
          twoFactorEnabled: false,
          status: "ACTIVE",
          createdAt: fixedNow,
          updatedAt: fixedNow,
        } as unknown as User,
        {
          ipAddress: "198.51.100.24",
          userAgent: "UnitTest/2.0",
          accept: "application/json",
        },
      );

      expect(emailService.sendNewDeviceLoginAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "notify@example.com",
          deviceSummary: expect.stringContaining("UnitTest/2.0"),
          ipAddress: "198.51.100.24",
        }),
      );
    });
  });
});

/* eslint-enable unicorn/no-null */
