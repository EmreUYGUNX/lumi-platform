import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { PrismaClient, User } from "@prisma/client";

import { createDeviceFingerprint } from "@/lib/crypto/fingerprint.js";
import type { createChildLogger } from "@/lib/logger.js";
import type { ApplicationConfig } from "@lumi/types";

import { AuthService } from "../auth.service.js";
import type { AuthRequestContext, AuthUserProfile } from "../auth.service.js";
import type { EmailService } from "../email.service.js";
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
  ({
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
  }) as unknown as ApplicationConfig;

interface PrismaMock {
  user: {
    findUnique: jest.Mock;
    update: jest.Mock;
  };
}

const createPrismaMock = (): PrismaMock =>
  ({
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
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

const createTokenServiceMock = (): TokenService =>
  ({
    verifyRefreshToken: jest.fn(),
    rotateRefreshToken: jest.fn(),
    revokeToken: jest.fn(),
    generateAccessToken: jest.fn(),
    generateRefreshToken: jest.fn(),
  }) as unknown as TokenService;

const createEmailServiceMock = (): EmailService =>
  ({
    sendVerificationEmail: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
    sendPasswordChangedNotification: jest.fn(),
    sendAccountLockoutNotification: jest.fn(),
    sendNewDeviceLoginAlert: jest.fn(),
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
});

/* eslint-enable unicorn/no-null */
