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
import { ConflictError, NotFoundError, UnauthorizedError, ValidationError } from "@/lib/errors.js";
import { createChildLogger } from "@/lib/logger.js";
import { getPrismaClient } from "@/lib/prisma.js";
import type { TokenPair } from "@/modules/auth/token.types.js";
import type { ApplicationConfig } from "@lumi/types";

import type { ChangePasswordRequest } from "./dto/change-password.dto.js";
import type { LoginRequest } from "./dto/login.dto.js";
import type { RegisterRequest } from "./dto/register.dto.js";
import type { ResetPasswordRequest } from "./dto/reset-password.dto.js";
import type { EmailService } from "./email.service.js";
import { createEmailService } from "./email.service.js";
import { type RbacService, createRbacService } from "./rbac.service.js";
import type { SecurityEventService } from "./security-event.service.js";
import { createSecurityEventService } from "./security-event.service.js";
import { type SessionDeviceMetadata, SessionService } from "./session.service.js";
import type { TokenService } from "./token.service.js";
import { createTokenService } from "./token.service.js";

/* eslint-disable unicorn/no-null -- Prisma models require explicit null assignments to clear nullable columns. */

const AUTH_LOGGER_COMPONENT = "auth:service";
const DEFAULT_CUSTOMER_ROLE = "customer";
const INVALID_CREDENTIALS_ERROR =
  "Invalid credentials. Please check your email and password combination.";

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

    this.sessionService =
      options.sessionService ??
      new SessionService({
        prisma: this.prisma,
        authConfig: this.authConfig,
        logger: createChildLogger(`${AUTH_LOGGER_COMPONENT}:session`),
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

    this.securityEvents =
      options.securityEventService ??
      createSecurityEventService({
        prisma: this.prisma,
        logger: createChildLogger(`${AUTH_LOGGER_COMPONENT}:security-events`),
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

    await this.emailService.sendVerificationEmail({
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
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      await this.securityEvents.log({
        type: "login_failed",
        ipAddress: context.device.ipAddress,
        userAgent: context.device.userAgent,
        payload: { email },
      });
      throw new UnauthorizedError(INVALID_CREDENTIALS_ERROR, {
        details: { reason: "invalid_credentials" },
      });
    }

    if (user.status !== "ACTIVE") {
      await this.securityEvents.log({
        type: "login_blocked_inactive",
        userId: user.id,
        ipAddress: context.device.ipAddress,
        userAgent: context.device.userAgent,
        payload: { status: user.status },
      });
      throw new UnauthorizedError("Account is not active. Please contact support.", {
        details: { reason: "account_inactive" },
      });
    }

    if (this.isAccountLocked(user)) {
      await this.securityEvents.log({
        type: "login_blocked_locked",
        userId: user.id,
        ipAddress: context.device.ipAddress,
        userAgent: context.device.userAgent,
        payload: {
          lockoutUntil: user.lockoutUntil?.toISOString(),
        },
      });
      throw new UnauthorizedError(
        "Account is temporarily locked due to repeated failed attempts.",
        {
          details: { reason: "account_locked", lockoutUntil: user.lockoutUntil },
        },
      );
    }

    const passwordMatches = await verifyPassword(input.password, user.passwordHash);

    if (!passwordMatches) {
      await this.handleFailedLogin(user, context);
      throw new UnauthorizedError(INVALID_CREDENTIALS_ERROR, {
        details: { reason: "invalid_credentials" },
      });
    }

    await this.resetFailedLoginState(user.id);

    const sessionResult = await this.issueSessionAndTokens(user, context.device);

    await this.securityEvents.log({
      type: "login_success",
      userId: user.id,
      ipAddress: context.device.ipAddress,
      userAgent: context.device.userAgent,
      payload: {
        sessionId: sessionResult.sessionId,
        device: createDeviceSummary(context.device),
      },
    });

    const profile = await this.buildUserProfile(user.id);

    return {
      user: profile,
      tokens: sessionResult.tokens,
      sessionId: sessionResult.sessionId,
      emailVerified: Boolean(user.emailVerified),
    };
  }

  async refresh(refreshToken: string, context: AuthRequestContext): Promise<RefreshResult> {
    const verification = await this.tokenService.verifyRefreshToken(refreshToken);
    const { payload, session } = verification;

    this.assertFingerprintMatches(session.fingerprint, context.device);

    const rotation = await this.tokenService.rotateRefreshToken(refreshToken);
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
      throw new ValidationError("Verification token is invalid or has already been used.", {
        issues: [
          {
            path: "token",
            message: "Verification token is invalid or has already been used.",
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
      throw new NotFoundError("User not found.", { details: { userId } });
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
      throw new NotFoundError("User not found.", { details: { userId } });
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

  private isAccountLocked(user: Pick<User, "lockoutUntil">): boolean {
    if (!user.lockoutUntil) {
      return false;
    }
    return user.lockoutUntil.getTime() > this.now().getTime();
  }

  private async handleFailedLogin(user: User, context: AuthRequestContext): Promise<void> {
    const { maxLoginAttempts, lockoutDurationSeconds } = this.authConfig.session;
    const shouldLock = user.failedLoginCount + 1 >= maxLoginAttempts;
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

    await this.securityEvents.log({
      type: "login_failed",
      userId: user.id,
      ipAddress: context.device.ipAddress,
      userAgent: context.device.userAgent,
      payload: {
        failedLoginCount: user.failedLoginCount + 1,
        locked: shouldLock,
        lockoutUntil: lockoutUntil?.toISOString(),
      },
    });

    if (shouldLock) {
      await this.emailService.sendAccountLockoutNotification({
        to: user.email,
        firstName: user.firstName,
        unlockAt: lockoutUntil!,
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
  ): Promise<{ tokens: TokenPair; sessionId: string }> {
    const sessionId = randomUUID();
    const refreshExpiresAt = new Date(
      this.now().getTime() + this.authConfig.jwt.refresh.ttlSeconds * 1000,
    );

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
      throw new NotFoundError("User not found.", { details: { userId } });
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
