/* istanbul ignore file -- AuthService behaviour is exercised through integration flows */
import { randomUUID } from "node:crypto";

import type {
  EmailVerificationToken,
  PasswordResetToken,
  Prisma,
  PrismaClient,
  User,
  UserStatus,
} from "@prisma/client";

import { getAuthConfig, getConfig } from "@/config/index.js";
import { createDeviceFingerprint } from "@/lib/crypto/fingerprint.js";
import { hashPassword, timingSafeStringCompare, verifyPassword } from "@/lib/crypto/password.js";
import {
  generateHashedTokenSecret,
  parseToken,
  serialiseToken,
  verifyTokenSecret,
} from "@/lib/crypto/token.js";
import type { EmailService } from "@/lib/email/email.service.js";
import { createEmailService } from "@/lib/email/email.service.js";
import { ConflictError, NotFoundError, UnauthorizedError, ValidationError } from "@/lib/errors.js";
import { createChildLogger } from "@/lib/logger.js";
import { getPrismaClient } from "@/lib/prisma.js";
import type { TokenPair } from "@/modules/auth/token.types.js";
import type { ApplicationConfig } from "@lumi/types";

import {
  type BruteForceProtectionService,
  createBruteForceProtectionService,
} from "./brute-force.service.js";
import type { ChangePasswordRequest } from "./dto/change-password.dto.js";
import type { LoginRequest } from "./dto/login.dto.js";
import type { RegisterRequest } from "./dto/register.dto.js";
import type { ResetPasswordRequest } from "./dto/reset-password.dto.js";
import { type RbacService, createRbacService } from "./rbac.service.js";
import type { SecurityEventService } from "./security-event.service.js";
import { createSecurityEventService } from "./security-event.service.js";
import {
  type SessionDeviceMetadata,
  type SessionSecurityNotifier,
  SessionService,
} from "./session.service.js";
import type { TokenService } from "./token.service.js";
import { createTokenService } from "./token.service.js";

/* eslint-disable unicorn/no-null -- Prisma models require explicit null assignments to clear nullable columns. */

const AUTH_LOGGER_COMPONENT = "auth:service";
const DEFAULT_CUSTOMER_ROLE = "customer";
const INVALID_CREDENTIALS_ERROR =
  "Invalid credentials. Please check your email and password combination.";
const USER_NOT_FOUND_ERROR = "User not found.";
const VERIFICATION_TOKEN_INVALID_ERROR = "Verification token is invalid or has already been used.";

export interface AuthRequestContext {
  device: SessionDeviceMetadata;
}

export interface AuthUserProfile {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  emailVerified: boolean;
  status: UserStatus;
  roles: string[];
  permissions: string[];
}

export interface RegisterResult {
  user: AuthUserProfile;
  emailVerification: {
    expiresAt: Date;
  };
}

export interface LoginResult {
  user: AuthUserProfile;
  tokens: TokenPair;
  sessionId: string;
  emailVerified: boolean;
}

export interface RefreshResult {
  user: AuthUserProfile;
  tokens: TokenPair;
  sessionId: string;
}

export interface LogoutResult {
  sessionId: string;
}

export interface LogoutAllResult {
  revokedCount: number;
}

export interface VerifyEmailResult {
  user: AuthUserProfile;
}

export interface ResetPasswordRequestResult {
  success: boolean;
}

export interface ResetPasswordResult {
  user: AuthUserProfile;
}

export interface ChangePasswordResult {
  user: AuthUserProfile;
}

export interface AuthServiceContract {
  register(input: RegisterRequest, context: AuthRequestContext): Promise<RegisterResult>;
  login(input: LoginRequest, context: AuthRequestContext): Promise<LoginResult>;
  refresh(refreshToken: string, context: AuthRequestContext): Promise<RefreshResult>;
  logout(sessionId: string, userId: string): Promise<LogoutResult>;
  logoutAll(userId: string): Promise<LogoutAllResult>;
  getProfile(userId: string): Promise<AuthUserProfile>;
  verifyEmail(token: string): Promise<VerifyEmailResult>;
  resendVerification(userId: string): Promise<VerifyEmailResult>;
  requestPasswordReset(
    email: string,
    context: AuthRequestContext,
  ): Promise<ResetPasswordRequestResult>;
  resetPassword(
    input: ResetPasswordRequest,
    context: AuthRequestContext,
  ): Promise<ResetPasswordResult>;
  changePassword(
    userId: string,
    sessionId: string,
    input: ChangePasswordRequest,
  ): Promise<ChangePasswordResult>;
}

export interface AuthServiceOptions {
  prisma?: PrismaClient;
  config?: ApplicationConfig;
  tokenService?: TokenService;
  sessionService?: SessionService;
  rbacService?: RbacService;
  emailService?: EmailService;
  securityEventService?: SecurityEventService;
  bruteForceProtection?: BruteForceProtectionService;
  logger?: ReturnType<typeof createChildLogger>;
  now?: () => Date;
}

const normaliseEmail = (email: string): string => email.trim().toLowerCase();

const createDeviceSummary = (device: SessionDeviceMetadata): string => {
  const agent = device.userAgent ?? "Unknown device";
  const ip = device.ipAddress ?? "unknown IP";
  return `${agent} (${ip})`;
};

export class AuthService implements AuthServiceContract {
  private readonly prisma: PrismaClient;

  private readonly config: ApplicationConfig;

  private readonly tokenService: TokenService;

  private readonly sessionService: SessionService;

  private readonly rbacService: RbacService;

  private readonly emailService: EmailService;

  private readonly securityEvents: SecurityEventService;

  private readonly bruteForceProtection: BruteForceProtectionService;

  private readonly logger: ReturnType<typeof createChildLogger>;

  private readonly now: () => Date;

  private readonly authConfig: ApplicationConfig["auth"];

  constructor(options: AuthServiceOptions = {}) {
    this.prisma = options.prisma ?? getPrismaClient();
    const resolvedConfig = options.config ?? getConfig();
    this.config = resolvedConfig;
    this.authConfig = resolvedConfig.auth ?? getAuthConfig();
    this.logger = options.logger ?? createChildLogger(AUTH_LOGGER_COMPONENT);
    this.now = options.now ?? (() => new Date());

    this.securityEvents =
      options.securityEventService ??
      createSecurityEventService({
        prisma: this.prisma,
        logger: createChildLogger(`${AUTH_LOGGER_COMPONENT}:security-events`),
      });

    this.bruteForceProtection =
      options.bruteForceProtection ??
      createBruteForceProtectionService({
        config: resolvedConfig,
        logger: createChildLogger(`${AUTH_LOGGER_COMPONENT}:brute-force`),
      });

    const sessionNotifier: SessionSecurityNotifier = {
      handleSessionRevoked: async ({ sessionId, userId, reason, revokedAt, ipAddress }) => {
        try {
          await this.securityEvents.log({
            type: "session_revoked",
            userId,
            payload: {
              sessionId,
              reason,
            },
            severity: "warning",
          });
        } catch (error) {
          this.logger.warn("Failed to publish session revocation security event", {
            error,
            sessionId,
            userId,
          });
        }

        if (reason === "manual_logout" || reason === "bulk_logout") {
          return;
        }

        if (!this.config.email.enabled) {
          return;
        }

        try {
          const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
              email: true,
              firstName: true,
            },
          });

          if (!user) {
            this.logger.warn("Skipping session revocation notification; user not found.", {
              userId,
              sessionId,
            });
            return;
          }

          await this.emailService.sendSessionRevokedNotification({
            to: user.email,
            firstName: user.firstName,
            revokedAt,
            reason,
            ipAddress,
          });
        } catch (error) {
          this.logger.warn("Failed to dispatch session revocation email.", {
            error,
            userId,
            sessionId,
            reason,
          });
        }
      },
      handleFingerprintMismatch: async ({ session, device }) => {
        try {
          await this.securityEvents.log({
            type: "session_fingerprint_mismatch",
            userId: session.userId,
            ipAddress: device?.ipAddress,
            userAgent: device?.userAgent,
            payload: {
              sessionId: session.id,
              fingerprintStored: Boolean(session.fingerprint),
            },
            severity: "critical",
          });
        } catch (error) {
          this.logger.warn("Failed to publish fingerprint mismatch security event", {
            error,
            sessionId: session.id,
            userId: session.userId,
          });
        }
      },
    };

    this.sessionService =
      options.sessionService ??
      new SessionService({
        prisma: this.prisma,
        authConfig: this.authConfig,
        logger: createChildLogger(`${AUTH_LOGGER_COMPONENT}:session`),
        notifier: sessionNotifier,
      });

    this.tokenService =
      options.tokenService ??
      createTokenService({
        prisma: this.prisma,
        authConfig: this.authConfig,
        sessionService: this.sessionService,
      });

    this.rbacService =
      options.rbacService ??
      createRbacService({
        prisma: this.prisma,
        logger: createChildLogger(`${AUTH_LOGGER_COMPONENT}:rbac`),
      });

    this.emailService =
      options.emailService ??
      createEmailService({
        config: this.config,
        logger: createChildLogger(`${AUTH_LOGGER_COMPONENT}:email`),
      });
  }

  async register(input: RegisterRequest, context: AuthRequestContext): Promise<RegisterResult> {
    const email = normaliseEmail(input.email);
    const existing = await this.prisma.user.findUnique({ where: { email } });

    if (existing) {
      throw new ConflictError("An account with this email already exists.", {
        details: { email },
      });
    }

    const passwordHash = await hashPassword(input.password);
    const { user, verification } = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email,
          passwordHash,
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone ?? undefined,
        },
      });

      await this.assignDefaultRole(tx, createdUser.id);

      const verificationToken = await this.createEmailVerificationToken(tx, createdUser);

      return {
        user: createdUser,
        verification: verificationToken,
      };
    });

    await this.securityEvents.log({
      type: "registration_success",
      userId: user.id,
      ipAddress: context.device.ipAddress,
      userAgent: context.device.userAgent,
      payload: {
        email: user.email,
      },
    });

    await this.emailService.sendWelcomeEmail({
      to: user.email,
      firstName: user.firstName,
      token: verification.token,
      expiresAt: verification.expiresAt,
    });

    const profile = await this.buildUserProfile(user.id);

    return {
      user: profile,
      emailVerification: {
        expiresAt: verification.expiresAt,
      },
    };
  }

  async login(input: LoginRequest, context: AuthRequestContext): Promise<LoginResult> {
    const email = normaliseEmail(input.email);
    await this.bruteForceProtection.applyDelay(email);
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      const bruteForce = await this.bruteForceProtection.recordFailure(email);
      await this.securityEvents.log({
        type: "login_failed",
        ipAddress: context.device.ipAddress,
        userAgent: context.device.userAgent,
        payload: {
          email,
          bruteForceAttempts: bruteForce.attempts,
          captchaRecommended: bruteForce.captchaRequired,
        },
      });
      if (bruteForce.captchaRequired) {
        await this.securityEvents.log({
          type: "login_captcha_threshold",
          ipAddress: context.device.ipAddress,
          userAgent: context.device.userAgent,
          payload: { email, attempts: bruteForce.attempts },
          severity: "warning",
        });
      }
      throw new UnauthorizedError(INVALID_CREDENTIALS_ERROR, {
        details: { reason: "invalid_credentials" },
      });
    }

    const account = await this.refreshLockoutState(user);

    if (account.status !== "ACTIVE") {
      await this.securityEvents.log({
        type: "login_blocked_inactive",
        userId: account.id,
        ipAddress: context.device.ipAddress,
        userAgent: context.device.userAgent,
        payload: { status: account.status },
      });
      throw new UnauthorizedError("Account is not active. Please contact support.", {
        details: { reason: "account_inactive" },
      });
    }

    if (this.isAccountLocked(account)) {
      const lockoutRemainingSeconds = this.getLockoutRemainingSeconds(account.lockoutUntil);
      const lockoutRemainingMinutes =
        lockoutRemainingSeconds > 0 ? Math.max(1, Math.ceil(lockoutRemainingSeconds / 60)) : 0;
      await this.securityEvents.log({
        type: "login_blocked_locked",
        userId: account.id,
        ipAddress: context.device.ipAddress,
        userAgent: context.device.userAgent,
        payload: {
          lockoutUntil: account.lockoutUntil?.toISOString(),
          lockoutRemainingSeconds,
          lockoutRemainingMinutes,
        },
      });
      throw new UnauthorizedError(
        lockoutRemainingSeconds > 0
          ? `Account is temporarily locked due to repeated failed attempts. Please try again in approximately ${lockoutRemainingMinutes} minute${
              lockoutRemainingMinutes === 1 ? "" : "s"
            }.`
          : "Account is temporarily locked due to repeated failed attempts.",
        {
          details: {
            reason: "account_locked",
            lockoutUntil: account.lockoutUntil,
            lockoutRemainingSeconds,
            lockoutRemainingMinutes,
          },
          exposeDetails: true,
        },
      );
    }

    const passwordMatches = await verifyPassword(input.password, account.passwordHash);

    if (!passwordMatches) {
      await this.handleFailedLogin(account, context);
      throw new UnauthorizedError(INVALID_CREDENTIALS_ERROR, {
        details: { reason: "invalid_credentials" },
      });
    }

    await this.resetFailedLoginState(account.id);
    await this.bruteForceProtection.reset(email);

    const sessionResult = await this.issueSessionAndTokens(account, context.device);

    await this.securityEvents.log({
      type: "login_success",
      userId: account.id,
      ipAddress: context.device.ipAddress,
      userAgent: context.device.userAgent,
      payload: {
        sessionId: sessionResult.sessionId,
        device: createDeviceSummary(context.device),
      },
    });

    if (sessionResult.newDevice) {
      await this.notifyNewDeviceLogin(account, context.device);
    }
    const profile = await this.buildUserProfile(account.id);

    return {
      user: profile,
      tokens: sessionResult.tokens,
      sessionId: sessionResult.sessionId,
      emailVerified: Boolean(account.emailVerified),
    };
  }

  async refresh(refreshToken: string, context: AuthRequestContext): Promise<RefreshResult> {
    let verification;
    try {
      verification = await this.tokenService.verifyRefreshToken(refreshToken);
    } catch (error) {
      await this.handleRefreshTokenReplayError(error, context);
      throw error;
    }

    const { payload, session } = verification;

    this.assertFingerprintMatches(session.fingerprint, context.device);

    let rotation;
    try {
      rotation = await this.tokenService.rotateRefreshToken(refreshToken);
    } catch (error) {
      await this.handleRefreshTokenReplayError(error, context, payload.sub);
      throw error;
    }
    const profile = await this.buildUserProfile(payload.sub);

    await this.securityEvents.log({
      type: "token_refreshed",
      userId: payload.sub,
      ipAddress: context.device.ipAddress,
      userAgent: context.device.userAgent,
      payload: {
        sessionId: rotation.session.id,
        previousTokenId: payload.jti,
        nextTokenId: rotation.refreshToken.payload.jti,
      },
    });

    return {
      user: profile,
      tokens: {
        accessToken: rotation.accessToken,
        refreshToken: rotation.refreshToken,
      },
      sessionId: rotation.session.id,
    };
  }

  async logout(sessionId: string, userId: string): Promise<LogoutResult> {
    await this.tokenService.revokeToken(sessionId, "manual_logout");
    await this.securityEvents.log({
      type: "logout",
      userId,
      payload: { sessionId },
    });
    return { sessionId };
  }

  async logoutAll(userId: string): Promise<LogoutAllResult> {
    const revokedCount = await this.sessionService.revokeAllUserSessions(userId, "bulk_logout");
    await this.securityEvents.log({
      type: "logout_all",
      userId,
      payload: { revokedCount },
    });
    return { revokedCount };
  }

  async getProfile(userId: string): Promise<AuthUserProfile> {
    return this.buildUserProfile(userId);
  }

  async verifyEmail(token: string): Promise<VerifyEmailResult> {
    const { id, secret } = parseToken(token);
    const record = await this.prisma.emailVerificationToken.findUnique({
      where: { id },
      include: {
        user: true,
      },
    });

    if (!record) {
      throw new ValidationError(VERIFICATION_TOKEN_INVALID_ERROR, {
        issues: [
          {
            path: "token",
            message: VERIFICATION_TOKEN_INVALID_ERROR,
          },
        ],
      });
    }

    this.assertTokenActive(record, "email_verification");

    const matches = await verifyTokenSecret(secret, record.tokenHash);
    if (!matches) {
      await this.sessionService.revokeAllUserSessions(record.userId, "verification_token_mismatch");
      throw new UnauthorizedError("Verification token is invalid.", {
        details: { reason: "token_mismatch" },
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.emailVerificationToken.update({
        where: { id: record.id },
        data: {
          consumedAt: this.now(),
        },
      });

      await tx.user.update({
        where: { id: record.userId },
        data: {
          emailVerified: true,
          emailVerifiedAt: this.now(),
        },
      });
    });

    await this.securityEvents.log({
      type: "email_verified",
      userId: record.userId,
      payload: {
        tokenId: record.id,
      },
    });

    const profile = await this.buildUserProfile(record.userId);

    return { user: profile };
  }

  async resendVerification(userId: string): Promise<VerifyEmailResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError(USER_NOT_FOUND_ERROR, { details: { userId } });
    }

    if (user.emailVerified) {
      throw new ConflictError("Email address has already been verified.");
    }

    const verification = await this.prisma.$transaction(async (tx) => {
      await tx.emailVerificationToken.updateMany({
        where: {
          userId,
          consumedAt: null,
        },
        data: {
          consumedAt: this.now(),
        },
      });

      return this.createEmailVerificationToken(tx, user);
    });

    await this.emailService.sendVerificationEmail({
      to: user.email,
      firstName: user.firstName,
      token: verification.token,
      expiresAt: verification.expiresAt,
    });

    await this.securityEvents.log({
      type: "email_verification_resent",
      userId,
      payload: {
        tokenExpiresAt: verification.expiresAt.toISOString(),
      },
    });

    const profile = await this.buildUserProfile(userId);

    return { user: profile };
  }

  async requestPasswordReset(
    email: string,
    context: AuthRequestContext,
  ): Promise<ResetPasswordRequestResult> {
    const normalisedEmail = normaliseEmail(email);
    const user = await this.prisma.user.findUnique({
      where: { email: normalisedEmail },
    });

    if (!user) {
      return { success: true };
    }

    const resetToken = await this.prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.updateMany({
        where: {
          userId: user.id,
          consumedAt: null,
        },
        data: { consumedAt: this.now() },
      });

      return this.createPasswordResetToken(tx, user, context.device);
    });

    await this.emailService.sendPasswordResetEmail({
      to: user.email,
      firstName: user.firstName,
      token: resetToken.token,
      expiresAt: resetToken.expiresAt,
    });

    await this.securityEvents.log({
      type: "password_reset_requested",
      userId: user.id,
      ipAddress: context.device.ipAddress,
      userAgent: context.device.userAgent,
      payload: {
        tokenExpiresAt: resetToken.expiresAt.toISOString(),
      },
    });

    return { success: true };
  }

  async resetPassword(
    input: ResetPasswordRequest,
    context: AuthRequestContext,
  ): Promise<ResetPasswordResult> {
    const { id, secret } = parseToken(input.token);
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { id },
      include: {
        user: true,
      },
    });

    if (!record) {
      throw new ValidationError("Password reset token is invalid or has expired.");
    }

    this.assertTokenActive(record, "password_reset");

    const matches = await verifyTokenSecret(secret, record.tokenHash);
    if (!matches) {
      await this.sessionService.revokeAllUserSessions(
        record.userId,
        "password_reset_token_mismatch",
      );
      throw new UnauthorizedError("Password reset token is invalid.", {
        details: { reason: "token_mismatch" },
      });
    }

    const passwordHash = await hashPassword(input.password);

    await this.prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.update({
        where: { id: record.id },
        data: {
          consumedAt: this.now(),
        },
      });

      await tx.user.update({
        where: { id: record.userId },
        data: {
          passwordHash,
          failedLoginCount: 0,
          lockoutUntil: null,
        },
      });
    });

    await this.sessionService.revokeAllUserSessions(record.userId, "password_reset");

    await this.emailService.sendPasswordChangedNotification({
      to: record.user.email,
      firstName: record.user.firstName,
      changedAt: this.now(),
      ipAddress: context.device.ipAddress,
    });

    await this.securityEvents.log({
      type: "password_reset_completed",
      userId: record.userId,
      ipAddress: context.device.ipAddress,
      userAgent: context.device.userAgent,
      payload: {
        tokenId: record.id,
      },
    });

    const profile = await this.buildUserProfile(record.userId);

    return { user: profile };
  }

  async changePassword(
    userId: string,
    sessionId: string,
    input: ChangePasswordRequest,
  ): Promise<ChangePasswordResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError(USER_NOT_FOUND_ERROR, { details: { userId } });
    }

    const currentMatches = await verifyPassword(input.currentPassword, user.passwordHash);
    if (!currentMatches) {
      throw new UnauthorizedError("Current password is incorrect.", {
        details: { reason: "current_password_incorrect" },
      });
    }

    const newPasswordHash = await hashPassword(input.newPassword);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newPasswordHash,
        failedLoginCount: 0,
        lockoutUntil: null,
      },
    });

    await this.revokeAllSessionsExcept(userId, sessionId);

    await this.emailService.sendPasswordChangedNotification({
      to: user.email,
      firstName: user.firstName,
      changedAt: this.now(),
    });

    await this.securityEvents.log({
      type: "password_changed",
      userId,
      payload: {
        sessionId,
      },
    });

    const profile = await this.buildUserProfile(userId);

    return { user: profile };
  }

  private async notifyNewDeviceLogin(user: User, device: SessionDeviceMetadata): Promise<void> {
    try {
      await this.emailService.sendNewDeviceLoginAlert({
        to: user.email,
        firstName: user.firstName,
        deviceSummary: createDeviceSummary(device),
        time: this.now(),
        ipAddress: device.ipAddress,
        userAgent: device.userAgent,
      });
    } catch (error) {
      this.logger.warn("Failed to dispatch new device login alert email.", {
        error,
        userId: user.id,
      });
    }
  }

  private async handleRefreshTokenReplayError(
    error: unknown,
    context: AuthRequestContext,
    fallbackUserId?: string,
  ): Promise<void> {
    if (!(error instanceof UnauthorizedError)) {
      return;
    }

    const details = (error.details ?? {}) as Record<string, unknown>;
    const reason = typeof details.reason === "string" ? details.reason : undefined;

    if (reason !== "token_reuse_detected") {
      return;
    }

    const userId = typeof details.userId === "string" ? details.userId : fallbackUserId;
    const sessionId = typeof details.sessionId === "string" ? details.sessionId : undefined;
    const revokedCount =
      typeof details.revokedCount === "number" ? details.revokedCount : undefined;

    if (!userId) {
      this.logger.warn("Refresh token replay detected but user could not be identified.", {
        sessionId,
      });
      return;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
      },
    });

    let userNotified = false;

    if (user) {
      try {
        await this.emailService.sendSecurityAlertEmail({
          to: user.email,
          firstName: user.firstName,
          category: "refresh_token_replay",
          metadata: {
            sessionId,
            revokedSessions: revokedCount,
            ipAddress: context.device.ipAddress,
            userAgent: context.device.userAgent,
          },
        });
        userNotified = true;
      } catch (emailError) {
        this.logger.error("Failed to dispatch security alert email for token replay detection.", {
          error: emailError,
          userId,
          sessionId,
        });
      }
    } else {
      this.logger.warn(
        "Unable to send security alert email for token replay detection; user not found.",
        {
          userId,
          sessionId,
        },
      );
    }

    await this.securityEvents.log({
      type: "refresh_token_replay_detected",
      userId: user ? userId : undefined,
      ipAddress: context.device.ipAddress,
      userAgent: context.device.userAgent,
      payload: {
        sessionId,
        revokedSessions: revokedCount,
        userNotified,
        userLookupSucceeded: Boolean(user),
      },
    });
  }

  private getLockoutRemainingSeconds(lockoutUntil?: Date | null): number {
    if (!lockoutUntil) {
      return 0;
    }

    const remainingMs = lockoutUntil.getTime() - this.now().getTime();
    if (remainingMs <= 0) {
      return 0;
    }

    return Math.ceil(remainingMs / 1000);
  }

  private isAccountLocked(user: Pick<User, "lockoutUntil">): boolean {
    return this.getLockoutRemainingSeconds(user.lockoutUntil) > 0;
  }

  private async refreshLockoutState(user: User): Promise<User> {
    if (!user.lockoutUntil) {
      return user;
    }

    const remainingSeconds = this.getLockoutRemainingSeconds(user.lockoutUntil);
    if (remainingSeconds > 0) {
      return user;
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: 0,
        lockoutUntil: null,
      },
    });

    return {
      ...user,
      failedLoginCount: 0,
      lockoutUntil: null,
    };
  }

  private async handleFailedLogin(user: User, context: AuthRequestContext): Promise<void> {
    const { maxLoginAttempts, lockoutDurationSeconds } = this.authConfig.session;
    const nextFailedCount = user.failedLoginCount + 1;
    const shouldLock = nextFailedCount >= maxLoginAttempts;
    const lockoutUntil = shouldLock
      ? new Date(this.now().getTime() + lockoutDurationSeconds * 1000)
      : null;

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: { increment: 1 },
        lockoutUntil,
      },
    });

    const bruteForce = await this.bruteForceProtection.recordFailure(user.email);

    await this.securityEvents.log({
      type: "login_failed",
      userId: user.id,
      ipAddress: context.device.ipAddress,
      userAgent: context.device.userAgent,
      payload: {
        failedLoginCount: nextFailedCount,
        locked: shouldLock,
        lockoutUntil: lockoutUntil?.toISOString(),
        lockoutDurationSeconds,
        bruteForceAttempts: bruteForce.attempts,
        captchaRecommended: bruteForce.captchaRequired,
      },
      severity: shouldLock ? "warning" : "info",
    });

    if (bruteForce.captchaRequired) {
      await this.securityEvents.log({
        type: "login_captcha_threshold",
        userId: user.id,
        ipAddress: context.device.ipAddress,
        userAgent: context.device.userAgent,
        payload: {
          attempts: bruteForce.attempts,
          email: user.email,
        },
        severity: "warning",
      });
    }

    if (shouldLock && lockoutUntil) {
      await this.securityEvents.log({
        type: "account_locked",
        userId: user.id,
        ipAddress: context.device.ipAddress,
        userAgent: context.device.userAgent,
        payload: {
          failedLoginCount: nextFailedCount,
          lockoutUntil: lockoutUntil.toISOString(),
          lockoutDurationSeconds,
        },
        severity: "warning",
      });

      await this.emailService.sendAccountLockoutNotification({
        to: user.email,
        firstName: user.firstName,
        unlockAt: lockoutUntil,
      });
    }
  }

  private async resetFailedLoginState(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginCount: 0,
        lockoutUntil: null,
      },
    });
  }

  private async issueSessionAndTokens(
    user: User,
    device: SessionDeviceMetadata,
  ): Promise<{ tokens: TokenPair; sessionId: string; newDevice: boolean }> {
    const sessionId = randomUUID();
    const refreshExpiresAt = new Date(
      this.now().getTime() + this.authConfig.jwt.refresh.ttlSeconds * 1000,
    );

    let newDevice = false;

    if (device) {
      const fingerprint = createDeviceFingerprint({
        ...device,
        secret: this.authConfig.session.fingerprintSecret,
      });

      const existingSession = await this.prisma.userSession.findFirst({
        where: {
          userId: user.id,
          fingerprint,
        },
        select: { id: true },
      });

      newDevice = !existingSession;
    }

    const sessionTemplate = {
      id: sessionId,
      userId: user.id,
      expiresAt: refreshExpiresAt,
      revokedAt: null,
      refreshTokenHash: "",
      fingerprint: null,
    } as const;

    const [refreshToken, accessToken] = await Promise.all([
      this.tokenService.generateRefreshToken({ user, session: sessionTemplate }),
      this.tokenService.generateAccessToken({ user, session: sessionTemplate }),
    ]);

    await this.sessionService.createSession({
      sessionId,
      userId: user.id,
      refreshToken: refreshToken.token,
      expiresAt: refreshToken.expiresAt,
      device,
    });

    return {
      tokens: {
        refreshToken,
        accessToken,
      },
      sessionId,
      newDevice,
    };
  }

  private async assignDefaultRole(tx: Prisma.TransactionClient, userId: string): Promise<void> {
    const role = await tx.role.findUnique({ where: { name: DEFAULT_CUSTOMER_ROLE } });
    if (!role) {
      this.logger.warn("Default customer role not found during registration.", {
        role: DEFAULT_CUSTOMER_ROLE,
      });
      return;
    }

    await tx.userRole.create({
      data: {
        userId,
        roleId: role.id,
      },
    });
  }

  private async createEmailVerificationToken(
    tx: Prisma.TransactionClient,
    user: Pick<User, "id">,
  ): Promise<{ token: string; expiresAt: Date }> {
    const token = await generateHashedTokenSecret();
    const expiresAt = new Date(
      this.now().getTime() + this.authConfig.tokens.emailVerification.ttlSeconds * 1000,
    );

    const record = await tx.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash: token.hash,
        expiresAt,
      },
    });

    return {
      token: serialiseToken(record.id, token.secret),
      expiresAt,
    };
  }

  private async createPasswordResetToken(
    tx: Prisma.TransactionClient,
    user: Pick<User, "id">,
    device: SessionDeviceMetadata,
  ): Promise<{ token: string; expiresAt: Date }> {
    const token = await generateHashedTokenSecret();
    const expiresAt = new Date(
      this.now().getTime() + this.authConfig.tokens.passwordReset.ttlSeconds * 1000,
    );

    const record = await tx.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: token.hash,
        expiresAt,
        requestedIp: device.ipAddress ?? undefined,
        userAgent: device.userAgent ?? undefined,
      },
    });

    return {
      token: serialiseToken(record.id, token.secret),
      expiresAt,
    };
  }

  private async buildUserProfile(userId: string): Promise<AuthUserProfile> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        emailVerified: true,
        status: true,
      },
    });

    if (!user) {
      throw new NotFoundError(USER_NOT_FOUND_ERROR, { details: { userId } });
    }

    const [roles, permissions] = await Promise.all([
      this.rbacService.getUserRoles(user.id),
      this.rbacService.getUserPermissions(user.id),
    ]);

    return {
      ...user,
      roles: roles.map((role) => role.name),
      permissions,
    };
  }

  private assertTokenActive(
    record: EmailVerificationToken | PasswordResetToken,
    scope: "email_verification" | "password_reset",
  ): void {
    if (record.consumedAt) {
      throw new ValidationError("Token has already been used.", {
        issues: [
          {
            path: "token",
            message: "Token has already been used.",
            code: scope,
          },
        ],
      });
    }

    if (record.expiresAt.getTime() <= this.now().getTime()) {
      throw new ValidationError("Token has expired.", {
        issues: [
          {
            path: "token",
            message: "Token has expired.",
            code: scope,
          },
        ],
      });
    }
  }

  private assertFingerprintMatches(
    storedFingerprint: string | null,
    device: SessionDeviceMetadata,
  ): void {
    if (!storedFingerprint) {
      return;
    }

    const expectedFingerprint = device
      ? createDeviceFingerprint({
          ...device,
          secret: this.authConfig.session.fingerprintSecret,
        })
      : undefined;

    if (!expectedFingerprint || !timingSafeStringCompare(storedFingerprint, expectedFingerprint)) {
      throw new UnauthorizedError("Authentication session fingerprint mismatch detected.", {
        details: { reason: "session_fingerprint_mismatch" },
      });
    }
  }

  private async revokeAllSessionsExcept(userId: string, sessionId: string): Promise<void> {
    const sessions = await this.prisma.userSession.findMany({
      where: {
        userId,
        revokedAt: null,
        NOT: { id: sessionId },
      },
      select: { id: true },
    });

    await Promise.all(
      sessions.map((session) => this.sessionService.revokeSession(session.id, "password_change")),
    );
  }
}

export const createAuthService = (options: AuthServiceOptions = {}): AuthService =>
  new AuthService(options);
