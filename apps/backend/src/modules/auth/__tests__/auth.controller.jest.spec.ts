import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { UserStatus } from "@prisma/client";
import type { CookieOptions, NextFunction, Request, Response } from "express";

import { createTestConfig } from "@/testing/config.js";
import type { ApplicationConfig } from "@lumi/types";

import { createAuthController } from "../auth.controller.js";
import type { AuthServiceContract, AuthUserProfile } from "../auth.service.js";
import type { AccessTokenClaims, RefreshTokenClaims } from "../token.types.js";

const createAccessTokenClaims = (
  overrides: Partial<AccessTokenClaims> = {},
): AccessTokenClaims => ({
  sub: overrides.sub ?? "user_123",
  email: overrides.email ?? "test@example.com",
  roleIds: overrides.roleIds ?? ["role_customer"],
  permissions: overrides.permissions ?? ["catalog:read"],
  sessionId: overrides.sessionId ?? "session_abc",
  jti: overrides.jti ?? "jti-123",
  iat: overrides.iat ?? Math.floor(Date.now() / 1000),
  exp: overrides.exp ?? Math.floor(Date.now() / 1000) + 900,
});

interface MockResponse extends Partial<Response> {
  statusCode: number;
  payload?: unknown;
  cookies: {
    name: string;
    value: string;
    options?: CookieOptions;
  }[];
}

const createMockResponse = (): MockResponse => {
  const res: MockResponse = {
    statusCode: 200,
    locals: {},
    cookies: [],
    status(code: number) {
      this.statusCode = code;
      return this as unknown as Response;
    },
    json(payload: unknown) {
      this.payload = payload;
      return this as unknown as Response;
    },
    cookie(name: string, value: string, options?: CookieOptions) {
      this.cookies.push({ name, value, options });
      return this as unknown as Response;
    },
  };

  return res;
};

interface MockRequestOptions {
  body?: Record<string, unknown>;
  cookies?: Record<string, string>;
  user?: unknown;
  headers?: Record<string, string>;
}

const createMockRequest = (options: MockRequestOptions = {}) => {
  const headers = Object.fromEntries(
    Object.entries(options.headers ?? {}).map(([key, value]) => [key.toLowerCase(), value]),
  );

  return {
    body: options.body ?? {},
    cookies: options.cookies ?? {},
    headers,
    ip: "192.168.1.10",
    user: options.user ?? undefined,
    get: (name: string) => headers[name.toLowerCase()],
    res: { locals: {} },
  } as unknown as Request;
};

const createAuthProfile = (overrides: Partial<AuthUserProfile> = {}): AuthUserProfile => ({
  id: overrides.id ?? "user_123",
  email: overrides.email ?? "test@example.com",
  firstName: overrides.firstName ?? "Test",
  lastName: overrides.lastName ?? "User",
  phone: overrides.phone ?? undefined,
  emailVerified: overrides.emailVerified ?? false,
  status: (overrides.status ?? "ACTIVE") as UserStatus,
  roles: overrides.roles ?? ["customer"],
  permissions: overrides.permissions ?? ["catalog:read"],
});

const createAccessToken = (tokenValue: string, expiresInSeconds: number) => ({
  token: tokenValue,
  expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
  payload: createAccessTokenClaims({ sessionId: "session_abc" }),
});

const createRefreshToken = (tokenValue: string, expiresInSeconds: number) => ({
  token: tokenValue,
  expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
  payload: {
    sub: "user_123",
    sessionId: "session_abc",
    jti: "jti-refresh-123",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
  } satisfies RefreshTokenClaims,
});

const createMockService = (): jest.Mocked<AuthServiceContract> => ({
  register: jest.fn(),
  login: jest.fn(),
  refresh: jest.fn(),
  logout: jest.fn(),
  logoutAll: jest.fn(),
  getProfile: jest.fn(),
  verifyEmail: jest.fn(),
  resendVerification: jest.fn(),
  requestPasswordReset: jest.fn(),
  resetPassword: jest.fn(),
  changePassword: jest.fn(),
});

const invokeHandler = async (
  handler: (req: Request, res: Response, next: NextFunction) => unknown,
  req: Request,
  res: MockResponse,
): Promise<{ next: jest.MockedFunction<NextFunction> }> => {
  const next = jest.fn((_error?: unknown) => {}) as jest.MockedFunction<NextFunction>;
  await handler(req, res as unknown as Response, next);
  return { next };
};

describe("AuthController", () => {
  let config: ApplicationConfig;
  let service: jest.Mocked<AuthServiceContract>;

  beforeEach(() => {
    config = createTestConfig();
    service = createMockService();
    jest.clearAllMocks();
  });

  it("normalises login payloads, sets refresh cookie, and returns session data", async () => {
    const controller = createAuthController({ service, config });
    const accessToken = createAccessToken("access-token", 900);
    const refreshToken = createRefreshToken("refresh-token", 3600);
    const profile = createAuthProfile();

    service.login.mockResolvedValue({
      user: profile,
      tokens: {
        accessToken,
        refreshToken,
      },
      sessionId: "session_abc",
      emailVerified: profile.emailVerified,
    });

    const req = createMockRequest({
      body: { email: "Test@Example.com", password: "Password!234" },
      headers: {
        "user-agent": "jest",
        accept: "application/json",
      },
    });

    const res = createMockResponse();
    const { next } = await invokeHandler(controller.login, req, res);

    expect(next).not.toHaveBeenCalled();
    expect(service.login).toHaveBeenCalledTimes(1);

    const [payload] = service.login.mock.calls[0] ?? [];
    expect(payload).toEqual({
      email: "test@example.com",
      password: "Password!234",
    });

    expect(res.cookies).toHaveLength(1);
    const refreshCookie = res.cookies[0]!;
    expect(refreshCookie.name).toBe("refreshToken");
    expect(refreshCookie.value).toBe("refresh-token");
    expect(refreshCookie.options).toBeDefined();
    expect(refreshCookie.options!).toMatchObject({
      httpOnly: true,
      sameSite: "strict",
      path: "/api",
      domain: config.auth.cookies.domain,
      maxAge: config.auth.jwt.refresh.ttlSeconds * 1000,
    });

    expect(res.payload).toMatchObject({
      success: true,
      data: {
        sessionId: "session_abc",
        accessToken: accessToken.token,
        refreshToken: refreshToken.token,
        user: {
          email: profile.email,
        },
      },
    });
  });

  it("returns validation errors for invalid registration payloads", async () => {
    const controller = createAuthController({ service, config });
    const req = createMockRequest({
      body: { email: "invalid", password: "short" },
    });
    const res = createMockResponse();

    const { next } = await invokeHandler(controller.register, req, res);

    expect(service.register).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0]?.[0];
    const appError = error as { code?: string } | undefined;
    expect(error).toBeInstanceOf(Error);
    expect(appError?.code).toBe("VALIDATION_ERROR");
  });

  it("rejects refresh attempts without cookies", async () => {
    const controller = createAuthController({ service, config });
    const req = createMockRequest();
    const res = createMockResponse();

    const { next } = await invokeHandler(controller.refresh, req, res);

    expect(service.refresh).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0]?.[0];
    const appError = error as { code?: string } | undefined;
    expect(appError?.code).toBe("UNAUTHORIZED");
  });

  it("delegates logout to the service and clears refresh cookie", async () => {
    const controller = createAuthController({ service, config });
    const req = createMockRequest({
      user: {
        id: "user_abc",
        sessionId: "session_xyz",
      },
    });
    const res = createMockResponse();

    service.logout.mockResolvedValue({ sessionId: "session_xyz" });

    const { next } = await invokeHandler(controller.logout, req, res);

    expect(next).not.toHaveBeenCalled();
    expect(service.logout).toHaveBeenCalledWith("session_xyz", "user_abc");

    const clearedCookie = res.cookies[0]!;
    expect(clearedCookie).toMatchObject({
      name: "refreshToken",
      value: "",
      options: expect.objectContaining({ maxAge: 0 }),
    });
  });

  it("handles password change requests for authenticated users", async () => {
    const controller = createAuthController({ service, config });
    const profile = createAuthProfile();

    service.changePassword.mockResolvedValue({ user: profile });

    const req = createMockRequest({
      user: {
        id: profile.id,
        sessionId: "session_abc",
      },
      body: {
        currentPassword: "OldPassword!234",
        newPassword: "NewPassword!567",
      },
    });
    const res = createMockResponse();

    const { next } = await invokeHandler(controller.changePassword, req, res);

    expect(next).not.toHaveBeenCalled();
    expect(service.changePassword).toHaveBeenCalledWith(profile.id, "session_abc", {
      currentPassword: "OldPassword!234",
      newPassword: "NewPassword!567",
    });

    expect(res.payload).toMatchObject({
      success: true,
      data: {
        user: {
          email: profile.email,
        },
      },
    });
  });

  it("returns 501 placeholder for two-factor setup endpoint", async () => {
    const controller = createAuthController({ service, config });
    const req = createMockRequest({
      user: { id: "user_123", sessionId: "session_abc" },
    });
    const res = createMockResponse();

    const { next } = await invokeHandler(controller.setupTwoFactor, req, res);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(501);
    expect(res.payload).toMatchObject({
      success: false,
      error: {
        code: "NOT_IMPLEMENTED",
      },
    });
  });

  it("returns 501 placeholder for two-factor verification endpoint", async () => {
    const controller = createAuthController({ service, config });
    const req = createMockRequest({
      user: { id: "user_123", sessionId: "session_abc" },
    });
    const res = createMockResponse();

    const { next } = await invokeHandler(controller.verifyTwoFactor, req, res);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(501);
    expect(res.payload).toMatchObject({
      success: false,
      error: {
        code: "NOT_IMPLEMENTED",
      },
    });
  });
});
