import { describe, expect, it, jest } from "@jest/globals";
import type { Request, Response } from "express";

import { UnauthorizedError, ValidationError } from "@/lib/errors.js";
import { createTestConfig } from "@/testing/config.js";
import type { ApplicationConfig } from "@lumi/types";

import { AuthController } from "../auth.controller.js";
import type {
  AuthRequestContext,
  AuthServiceContract,
  AuthUserProfile,
  ChangePasswordResult,
  LoginResult,
  LogoutAllResult,
  LogoutResult,
  RefreshResult,
  ResetPasswordResult,
  VerifyEmailResult,
} from "../auth.service.js";
import type { ChangePasswordRequest } from "../dto/change-password.dto.js";
import type { LoginRequest } from "../dto/login.dto.js";
import type { RegisterRequest } from "../dto/register.dto.js";
import type { ResetPasswordRequest } from "../dto/reset-password.dto.js";
import type { AccessTokenClaims, AuthenticatedUser } from "../token.types.js";

const createProfile = (): AuthUserProfile => ({
  id: "user_123",
  email: "user@example.com",
  firstName: "Ada",
  lastName: "Lovelace",
  phone: "+905551112233",
  emailVerified: true,
  status: "ACTIVE",
  roles: ["role_admin"],
  permissions: ["manage:users"],
});

const createAccessTokenClaims = (
  overrides: Partial<AccessTokenClaims> = {},
): AccessTokenClaims => ({
  sub: "user_123",
  email: "user@example.com",
  roleIds: [],
  permissions: [],
  sessionId: "session_123",
  jti: "jti",
  iat: 0,
  exp: 0,
  ...overrides,
});

const createConfig = (
  overrides: Partial<ApplicationConfig["app"]> = {},
  environment: ApplicationConfig["app"]["environment"] = "test",
): ApplicationConfig =>
  createTestConfig({
    app: {
      name: "Lumi Platform",
      apiBaseUrl: "https://api.lumi.dev",
      frontendUrl: "https://app.lumi.dev",
      environment,
      port: 3000,
      ...overrides,
    },
    auth: {
      cookies: {
        domain: "lumi.dev",
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
      session: {
        fingerprintSecret: "fingerprint-secret",
        lockoutDurationSeconds: 900,
        maxLoginAttempts: 5,
      },
      tokens: {
        emailVerification: { ttlSeconds: 86_400 },
        passwordReset: { ttlSeconds: 3600 },
      },
    },
  });

const createResponseMock = () => {
  const res = {} as Response;
  const status = jest.fn(() => res);
  const json = jest.fn(() => res);
  const cookie = jest.fn(() => res);
  res.status = status as unknown as Response["status"];
  res.json = json as unknown as Response["json"];
  res.cookie = cookie as unknown as Response["cookie"];
  return { res, status, json, cookie };
};

const createServiceStub = (): AuthServiceContract => ({
  register: jest.fn(async (_input: RegisterRequest) => ({
    user: createProfile(),
    emailVerification: {
      expiresAt: new Date("2025-01-01T00:00:00.000Z"),
    },
  })),
  login: jest.fn(
    async (_input: LoginRequest, _context: AuthRequestContext): Promise<LoginResult> => ({
      user: createProfile(),
      tokens: {
        accessToken: {
          token: "access-token",
          expiresAt: new Date("2025-01-01T00:15:00.000Z"),
          payload: createAccessTokenClaims(),
        },
        refreshToken: {
          token: "refresh-token",
          expiresAt: new Date("2025-02-01T00:00:00.000Z"),
          payload: { ...createAccessTokenClaims(), jti: "refresh-jti" },
        },
      },
      sessionId: "session_123",
      emailVerified: true,
    }),
  ),
  refresh: jest.fn(
    async (_token: string, _context: AuthRequestContext): Promise<RefreshResult> => ({
      user: createProfile(),
      tokens: {
        accessToken: {
          token: "new-access",
          expiresAt: new Date("2025-01-01T01:00:00.000Z"),
          payload: createAccessTokenClaims({ jti: "new-access-jti" }),
        },
        refreshToken: {
          token: "new-refresh",
          expiresAt: new Date("2025-02-01T00:00:00.000Z"),
          payload: { ...createAccessTokenClaims(), jti: "new-refresh-jti" },
        },
      },
      sessionId: "session_456",
    }),
  ),
  logout: jest.fn(
    async (_sessionId: string, _userId: string): Promise<LogoutResult> => ({
      sessionId: "session_123",
    }),
  ),
  logoutAll: jest.fn(
    async (_userId: string): Promise<LogoutAllResult> => ({
      revokedCount: 3,
    }),
  ),
  getProfile: jest.fn(async (_userId: string) => createProfile()),
  verifyEmail: jest.fn(
    async (_token: string): Promise<VerifyEmailResult> => ({
      user: createProfile(),
    }),
  ),
  resendVerification: jest.fn(
    async (_userId: string): Promise<VerifyEmailResult> => ({
      user: createProfile(),
    }),
  ),
  requestPasswordReset: jest.fn(async (_email: string, _context: AuthRequestContext) => ({
    success: true,
  })),
  resetPassword: jest.fn(
    async (
      _input: ResetPasswordRequest,
      _context: AuthRequestContext,
    ): Promise<ResetPasswordResult> => ({
      user: createProfile(),
    }),
  ),
  changePassword: jest.fn(
    async (
      _userId: string,
      _sessionId: string,
      _input: ChangePasswordRequest,
    ): Promise<ChangePasswordResult> => ({
      user: createProfile(),
    }),
  ),
});

const createRequest = (overrides: Partial<Request> = {}): Request =>
  ({
    body: {},
    cookies: {},
    headers: {},
    ip: "203.0.113.10",
    get: jest.fn((header: string): string | undefined => {
      if (header.toLowerCase() === "user-agent") {
        return "JestAgent/1.0";
      }
      if (header.toLowerCase() === "accept") {
        return "application/json";
      }
      return undefined;
    }),
    ...overrides,
  }) as unknown as Request;

const createController = (
  options: {
    service?: AuthServiceContract;
    environment?: ApplicationConfig["app"]["environment"];
  } = {},
) => {
  return new AuthController({
    service: options.service ?? createServiceStub(),
    config: createConfig({}, options.environment ?? "test"),
  });
};

const createAuthenticatedUser = (
  overrides: Partial<AuthenticatedUser> = {},
): AuthenticatedUser => ({
  id: "user_123",
  email: "user@example.com",
  roles: [{ id: "role_admin", name: "admin" }],
  permissions: ["manage:users"],
  sessionId: "session_123",
  token: createAccessTokenClaims(),
  ...overrides,
});

interface InternalController {
  handleRegister: (req: Request, res: Response) => Promise<void>;
  handleLogin: (req: Request, res: Response) => Promise<void>;
  handleRefresh: (req: Request, res: Response) => Promise<void>;
  handleLogout: (req: Request, res: Response) => Promise<void>;
  handleForgotPassword: (req: Request, res: Response) => Promise<void>;
  handleResetPassword: (req: Request, res: Response) => Promise<void>;
  handleChangePassword: (req: Request, res: Response) => Promise<void>;
}

describe("AuthController handlers", () => {
  it("validates and registers users", async () => {
    const service = createServiceStub();
    const controller = createController({ service });
    const internal = controller as unknown as InternalController;
    const { res, status, json } = createResponseMock();

    const req = createRequest({
      body: {
        email: "User@example.com",
        password: "StrongPassw0rd!",
        firstName: "Ada",
        lastName: "Lovelace",
      },
    });

    await internal.handleRegister(req, res);

    expect(service.register).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "user@example.com",
      }),
      expect.any(Object),
    );
    expect(status).toHaveBeenCalledWith(201);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          user: expect.objectContaining({ email: "user@example.com" }),
        }),
      }),
    );
  });

  it("throws validation error for malformed login payloads", async () => {
    const controller = createController();
    const internal = controller as unknown as InternalController;
    const req = createRequest({
      body: {
        email: 42,
      },
    });
    const { res } = createResponseMock();

    await expect(internal.handleLogin(req, res)).rejects.toThrow(ValidationError);
  });

  it("requires refresh token when refreshing sessions", async () => {
    const controller = createController();
    const internal = controller as unknown as InternalController;
    const req = createRequest({ cookies: {} });
    const { res } = createResponseMock();

    await expect(internal.handleRefresh(req, res)).rejects.toThrow(UnauthorizedError);
  });

  it("sets secure refresh cookies outside development", async () => {
    const service = createServiceStub();
    const controller = createController({ service });
    const req = createRequest({
      cookies: { refreshToken: "existing-token" },
    });
    const { res, cookie } = createResponseMock();

    const internal = controller as unknown as InternalController;
    await internal.handleRefresh(req, res);

    expect(cookie).toHaveBeenCalledWith(
      "refreshToken",
      "new-refresh",
      expect.objectContaining({
        secure: true,
        domain: "lumi.dev",
        path: "/api",
      }),
    );
  });

  it("clears refresh cookies and enforces authentication for logout", async () => {
    const service = createServiceStub();
    const controller = createController({ service });
    const { res, cookie } = createResponseMock();

    const internal = controller as unknown as InternalController;
    await expect(internal.handleLogout(createRequest(), res)).rejects.toThrow(UnauthorizedError);

    await internal.handleLogout(createRequest({ user: createAuthenticatedUser() }), res);

    expect(service.logout).toHaveBeenCalledWith("session_123", "user_123");
    expect(cookie).toHaveBeenCalledWith("refreshToken", "", expect.objectContaining({ maxAge: 0 }));
  });

  it("normalises email input during password reset requests", async () => {
    const service = createServiceStub();
    const controller = createController({ service });
    const req = createRequest({
      body: { email: "  USER@Example.com " },
    });
    const { res } = createResponseMock();

    const internal = controller as unknown as InternalController;
    await internal.handleForgotPassword(req, res);

    expect(service.requestPasswordReset).toHaveBeenCalledWith(
      "user@example.com",
      expect.any(Object),
    );
  });

  it("rejects missing email values during password reset requests", async () => {
    const controller = createController();
    const internal = controller as unknown as InternalController;
    const req = createRequest({ body: { email: "" } });
    const { res } = createResponseMock();

    await expect(internal.handleForgotPassword(req, res)).rejects.toThrow(ValidationError);
  });

  it("disables secure cookies in development environments", async () => {
    const service = createServiceStub();
    const controller = createController({ service, environment: "development" });
    const internal = controller as unknown as InternalController;
    const req = createRequest({
      cookies: { refreshToken: "token" },
    });
    const { res, cookie } = createResponseMock();

    await internal.handleRefresh(req, res);

    expect(cookie).toHaveBeenCalledWith(
      "refreshToken",
      "new-refresh",
      expect.objectContaining({ secure: false }),
    );
  });
});
