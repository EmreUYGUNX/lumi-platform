/* istanbul ignore file -- controller wiring validated via API integration tests */
import type { Request, RequestHandler, Response } from "express";
import { ZodError } from "zod";

import { getConfig } from "@/config/index.js";
import { asyncHandler } from "@/lib/asyncHandler.js";
import { UnauthorizedError, ValidationError } from "@/lib/errors.js";
import type { ValidationErrorDetail } from "@/lib/errors.js";
import { errorResponse, successResponse } from "@/lib/response.js";
import type { ApplicationConfig } from "@lumi/types";

import { createAuthService } from "./auth.service.js";
import type { AuthRequestContext, AuthServiceContract, AuthUserProfile } from "./auth.service.js";
import type { ChangePasswordRequest } from "./dto/change-password.dto.js";
import { ChangePasswordRequestSchema } from "./dto/change-password.dto.js";
import type { LoginRequest } from "./dto/login.dto.js";
import { LoginRequestSchema } from "./dto/login.dto.js";
import type { RegisterRequest } from "./dto/register.dto.js";
import { RegisterRequestSchema } from "./dto/register.dto.js";
import type { ResetPasswordRequest } from "./dto/reset-password.dto.js";
import { ResetPasswordRequestSchema } from "./dto/reset-password.dto.js";

const AUTH_REQUIRED_MESSAGE = "Authentication required.";
const TWO_FACTOR_MESSAGES = {
  setup: "Two-factor authentication setup is scheduled for a future release.",
  verify: "Two-factor authentication verification is scheduled for a future release.",
} as const;

const REFRESH_COOKIE_NAME = "refreshToken";
const REFRESH_COOKIE_PATH = "/api";

interface ParsedValidation<T> {
  data: T;
}

const formatValidationIssues = <T>(error: ZodError<T>): ValidationErrorDetail[] =>
  error.issues.map((issue) => ({
    path: issue.path.map(String).join(".") || "root",
    message: issue.message,
    code: issue.code,
  }));

const parseBodyOrThrow = <T>(
  schema: { parse(input: unknown): T },
  body: unknown,
  message: string,
): ParsedValidation<T> => {
  try {
    return { data: schema.parse(body) };
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ValidationError(message, {
        issues: formatValidationIssues(error),
      });
    }

    throw error;
  }
};

const parseEmailInput = (input: unknown): string => {
  if (typeof input !== "string" || input.trim().length === 0) {
    throw new ValidationError("Email is required.", {
      issues: [
        {
          path: "email",
          message: "Email is required.",
        },
      ],
    });
  }

  return input.trim().toLowerCase();
};

const parseTokenInput = (input: unknown): string => {
  if (typeof input !== "string" || input.trim().length === 0) {
    throw new ValidationError("Token is required.", {
      issues: [
        {
          path: "token",
          message: "Token is required.",
        },
      ],
    });
  }

  return input.trim();
};

const serializeUserProfile = (profile: AuthUserProfile) => ({
  id: profile.id,
  email: profile.email,
  firstName: profile.firstName,
  lastName: profile.lastName,
  phone: profile.phone,
  emailVerified: profile.emailVerified,
  status: profile.status,
  roles: profile.roles,
  permissions: profile.permissions,
});

const buildAuthContext = (req: Request): AuthRequestContext => ({
  device: {
    ipAddress: req.ip ?? undefined,
    userAgent: req.get("user-agent") ?? undefined,
    accept: req.get("accept") ?? undefined,
  },
});

const resolveRefreshToken = (req: Request): string | undefined => {
  const requestWithSignedCookies = req as Request & {
    signedCookies?: Record<string, unknown>;
  };

  const signedCookies = requestWithSignedCookies.signedCookies ?? {};
  if (signedCookies && typeof signedCookies === "object") {
    // eslint-disable-next-line security/detect-object-injection -- Cookie name is a controlled constant.
    const signedToken = (signedCookies as Record<string, unknown>)[REFRESH_COOKIE_NAME];
    if (typeof signedToken === "string" && signedToken.length > 0) {
      return signedToken;
    }
  }

  const cookies = req.cookies ?? {};
  if (cookies && typeof cookies === "object" && REFRESH_COOKIE_NAME in cookies) {
    // eslint-disable-next-line security/detect-object-injection -- Cookie name is a controlled constant.
    const tokenCandidate = (cookies as Record<string, unknown>)[REFRESH_COOKIE_NAME];
    if (typeof tokenCandidate === "string" && tokenCandidate.length > 0) {
      return tokenCandidate;
    }
  }

  return undefined;
};

export interface AuthControllerOptions {
  service?: AuthServiceContract;
  config?: ApplicationConfig;
}

export class AuthController {
  public readonly register: RequestHandler;

  public readonly login: RequestHandler;

  public readonly refresh: RequestHandler;

  public readonly logout: RequestHandler;

  public readonly logoutAll: RequestHandler;

  public readonly me: RequestHandler;

  public readonly verifyEmail: RequestHandler;

  public readonly resendVerification: RequestHandler;

  public readonly forgotPassword: RequestHandler;

  public readonly resetPassword: RequestHandler;

  public readonly changePassword: RequestHandler;

  public readonly setupTwoFactor: RequestHandler;

  public readonly verifyTwoFactor: RequestHandler;

  private readonly service: AuthServiceContract;

  private readonly config: ApplicationConfig;

  private readonly secureCookies: boolean;

  constructor(options: AuthControllerOptions = {}) {
    this.config = options.config ?? getConfig();
    this.service =
      options.service ??
      createAuthService({
        config: this.config,
      });

    this.secureCookies = this.config.app.environment !== "development";

    this.register = asyncHandler(this.handleRegister.bind(this));
    this.login = asyncHandler(this.handleLogin.bind(this));
    this.refresh = asyncHandler(this.handleRefresh.bind(this));
    this.logout = asyncHandler(this.handleLogout.bind(this));
    this.logoutAll = asyncHandler(this.handleLogoutAll.bind(this));
    this.me = asyncHandler(this.handleMe.bind(this));
    this.verifyEmail = asyncHandler(this.handleVerifyEmail.bind(this));
    this.resendVerification = asyncHandler(this.handleResendVerification.bind(this));
    this.forgotPassword = asyncHandler(this.handleForgotPassword.bind(this));
    this.resetPassword = asyncHandler(this.handleResetPassword.bind(this));
    this.changePassword = asyncHandler(this.handleChangePassword.bind(this));
    this.setupTwoFactor = asyncHandler(this.handleSetupTwoFactor.bind(this));
    this.verifyTwoFactor = asyncHandler(this.handleVerifyTwoFactor.bind(this));
  }

  private async handleRegister(req: Request, res: Response): Promise<void> {
    const { data } = parseBodyOrThrow<RegisterRequest>(
      RegisterRequestSchema,
      req.body,
      "Registration payload validation failed.",
    );

    const context = buildAuthContext(req);
    const result = await this.service.register(data, context);

    res.status(201).json(
      successResponse({
        user: serializeUserProfile(result.user),
        emailVerification: {
          expiresAt: result.emailVerification.expiresAt.toISOString(),
        },
      }),
    );
  }

  private async handleLogin(req: Request, res: Response): Promise<void> {
    const { data } = parseBodyOrThrow<LoginRequest>(
      LoginRequestSchema,
      req.body,
      "Login payload is invalid.",
    );

    const context = buildAuthContext(req);
    const result = await this.service.login(data, context);

    this.setRefreshCookie(
      res,
      result.tokens.refreshToken.token,
      result.tokens.refreshToken.expiresAt,
    );

    res.json(
      successResponse({
        sessionId: result.sessionId,
        accessToken: result.tokens.accessToken.token,
        refreshToken: result.tokens.refreshToken.token,
        accessTokenExpiresAt: result.tokens.accessToken.expiresAt.toISOString(),
        refreshTokenExpiresAt: result.tokens.refreshToken.expiresAt.toISOString(),
        user: serializeUserProfile(result.user),
        emailVerified: result.emailVerified,
      }),
    );
  }

  private async handleRefresh(req: Request, res: Response): Promise<void> {
    const refreshToken = resolveRefreshToken(req);

    if (!refreshToken) {
      throw new UnauthorizedError("Refresh token is required.", {
        details: { reason: "refresh_token_missing" },
      });
    }

    const context = buildAuthContext(req);
    const result = await this.service.refresh(refreshToken, context);

    this.setRefreshCookie(
      res,
      result.tokens.refreshToken.token,
      result.tokens.refreshToken.expiresAt,
    );

    res.json(
      successResponse({
        sessionId: result.sessionId,
        accessToken: result.tokens.accessToken.token,
        refreshToken: result.tokens.refreshToken.token,
        accessTokenExpiresAt: result.tokens.accessToken.expiresAt.toISOString(),
        refreshTokenExpiresAt: result.tokens.refreshToken.expiresAt.toISOString(),
        user: serializeUserProfile(result.user),
      }),
    );
  }

  private async handleLogout(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new UnauthorizedError(AUTH_REQUIRED_MESSAGE);
    }

    const { sessionId, id: userId } = req.user;
    const result = await this.service.logout(sessionId, userId);
    this.clearRefreshCookie(res);

    res.json(
      successResponse({
        sessionId: result.sessionId,
      }),
    );
  }

  private async handleLogoutAll(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new UnauthorizedError(AUTH_REQUIRED_MESSAGE);
    }

    const { id: userId } = req.user;
    const result = await this.service.logoutAll(userId);
    this.clearRefreshCookie(res);

    res.json(
      successResponse({
        revokedSessions: result.revokedCount,
      }),
    );
  }

  private async handleMe(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new UnauthorizedError(AUTH_REQUIRED_MESSAGE);
    }

    const { id: userId } = req.user;
    const profile = await this.service.getProfile(userId);
    res.json(successResponse({ user: serializeUserProfile(profile) }));
  }

  private async handleVerifyEmail(req: Request, res: Response): Promise<void> {
    const token = parseTokenInput(req.body?.token);
    const result = await this.service.verifyEmail(token);

    res.json(successResponse({ user: serializeUserProfile(result.user) }));
  }

  private async handleResendVerification(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new UnauthorizedError(AUTH_REQUIRED_MESSAGE);
    }

    const { id: userId } = req.user;
    const result = await this.service.resendVerification(userId);
    res.json(successResponse({ user: serializeUserProfile(result.user) }));
  }

  private async handleForgotPassword(req: Request, res: Response): Promise<void> {
    const email = parseEmailInput(req.body?.email);
    const context = buildAuthContext(req);
    await this.service.requestPasswordReset(email, context);

    res.json(successResponse({ message: "If the account exists, a reset link has been sent." }));
  }

  private async handleResetPassword(req: Request, res: Response): Promise<void> {
    const { data } = parseBodyOrThrow<ResetPasswordRequest>(
      ResetPasswordRequestSchema,
      req.body,
      "Password reset payload is invalid.",
    );

    const context = buildAuthContext(req);
    const result = await this.service.resetPassword(data, context);

    res.json(successResponse({ user: serializeUserProfile(result.user) }));
  }

  private async handleChangePassword(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new UnauthorizedError(AUTH_REQUIRED_MESSAGE);
    }

    const { data } = parseBodyOrThrow<ChangePasswordRequest>(
      ChangePasswordRequestSchema,
      req.body,
      "Change password payload is invalid.",
    );

    const { id: userId, sessionId } = req.user;
    const result = await this.service.changePassword(userId, sessionId, data);

    res.json(successResponse({ user: serializeUserProfile(result.user) }));
  }

  private async handleSetupTwoFactor(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new UnauthorizedError(AUTH_REQUIRED_MESSAGE);
    }

    const { environment } = this.config.app;

    res.status(501).json(
      errorResponse({
        code: "NOT_IMPLEMENTED",
        message: TWO_FACTOR_MESSAGES.setup,
        details: {
          plannedFeatures: ["totp_enrollment", "recovery_codes"],
          environment,
        },
      }),
    );
  }

  private async handleVerifyTwoFactor(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new UnauthorizedError(AUTH_REQUIRED_MESSAGE);
    }

    const { environment } = this.config.app;

    res.status(501).json(
      errorResponse({
        code: "NOT_IMPLEMENTED",
        message: TWO_FACTOR_MESSAGES.verify,
        details: {
          plannedFeatures: ["totp_verification", "backup_code_verification"],
          environment,
        },
      }),
    );
  }

  private setRefreshCookie(res: Response, token: string, expiresAt: Date): void {
    res.cookie(REFRESH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: this.secureCookies,
      sameSite: "strict",
      domain: this.config.auth.cookies.domain,
      path: REFRESH_COOKIE_PATH,
      maxAge: this.config.auth.jwt.refresh.ttlSeconds * 1000,
      expires: expiresAt,
      signed: true,
    });
  }

  private clearRefreshCookie(res: Response): void {
    res.cookie(REFRESH_COOKIE_NAME, "", {
      httpOnly: true,
      secure: this.secureCookies,
      sameSite: "strict",
      domain: this.config.auth.cookies.domain,
      path: REFRESH_COOKIE_PATH,
      maxAge: 0,
      expires: new Date(0),
      signed: true,
    });
  }
}

export const createAuthController = (options: AuthControllerOptions = {}): AuthController =>
  new AuthController(options);
