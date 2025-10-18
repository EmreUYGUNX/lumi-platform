import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { NextFunction, Request, Response } from "express";

import { UnauthorizedError } from "@/lib/errors.js";
import * as logger from "@/lib/logger.js";
import type { TokenService } from "@/modules/auth/token.service.js";
import type { AccessTokenClaims, AuthenticatedUser } from "@/modules/auth/token.types.js";

import { createDeserializeUserMiddleware } from "../deserializeUser.js";

const buildRequest = (overrides: Partial<Request> = {}): Request =>
  ({
    headers: {},
    cookies: {},
    originalUrl: "/test",
    id: "req-1",
    ...overrides,
  }) as Request;

const buildResponse = (): Response =>
  ({
    locals: {},
  }) as unknown as Response;

describe("createDeserializeUserMiddleware", () => {
  let tokenService: jest.Mocked<TokenService>;
  let next: NextFunction;
  let req: Request;
  let res: Response;
  let mergeSpy: jest.SpiedFunction<typeof logger.mergeRequestContext>;
  let childLoggerSpy: jest.SpiedFunction<typeof logger.createChildLogger>;

  beforeEach(() => {
    next = jest.fn();
    req = buildRequest();
    res = buildResponse();

    tokenService = {
      verifyAccessToken: jest.fn(),
      fetchAuthenticatedUser: jest.fn(),
      createRequestAuthState: jest.fn(),
      shutdown: jest.fn(),
    } as unknown as jest.Mocked<TokenService>;

    tokenService.createRequestAuthState.mockImplementation((_token, overrides) => ({
      accessToken: _token,
      ...overrides,
    }));

    mergeSpy = jest.spyOn(logger, "mergeRequestContext").mockImplementation(() => {});
    childLoggerSpy = jest.spyOn(logger, "createChildLogger").mockReturnValue({
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as ReturnType<typeof logger.createChildLogger>);
  });

  afterEach(() => {
    mergeSpy.mockRestore();
    childLoggerSpy.mockRestore();
  });

  it("records refresh token presence when authorization header is missing", async () => {
    req.cookies = { refreshToken: "refresh_token_value" };

    const middleware = createDeserializeUserMiddleware({ tokenService });
    await middleware(req, res, next);

    expect(res.locals.auth).toMatchObject({
      refreshToken: "refresh_token_value",
      refreshTokenPresent: true,
    });
    expect(next).toHaveBeenCalled();
    expect(tokenService.verifyAccessToken).not.toHaveBeenCalled();
  });

  it("attaches authenticated user context when access token is valid", async () => {
    const claims: AccessTokenClaims = {
      sub: "user_1",
      email: "user@example.com",
      roleIds: ["role_admin"],
      permissions: ["manage:users"],
      sessionId: "session_1",
      jti: "token_1",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 900,
    };

    const user: AuthenticatedUser = {
      id: "user_1",
      email: "user@example.com",
      roles: [{ id: "role_admin", name: "admin" }],
      permissions: ["manage:users"],
      sessionId: "session_1",
      token: claims,
    };

    req.headers.authorization = `Bearer access-token`;
    req.cookies = { refreshToken: "refresh_token_value" };

    tokenService.verifyAccessToken.mockResolvedValue(claims);
    tokenService.fetchAuthenticatedUser.mockResolvedValue(user);

    const middleware = createDeserializeUserMiddleware({ tokenService });
    await middleware(req, res, next);

    expect(tokenService.verifyAccessToken).toHaveBeenCalledWith("access-token");
    expect(tokenService.fetchAuthenticatedUser).toHaveBeenCalledWith(claims);
    expect(req.user).toEqual(user);
    expect(res.locals.auth).toMatchObject({
      accessToken: claims,
      refreshToken: "refresh_token_value",
      refreshTokenPresent: true,
    });
    expect(mergeSpy).toHaveBeenCalledWith({
      userId: user.id,
      sessionId: user.sessionId,
      tokenId: claims.jti,
    });
    expect(next).toHaveBeenCalled();
  });

  it("captures unauthorized errors without interrupting request flow", async () => {
    req.headers.authorization = "Bearer invalid-token";
    tokenService.verifyAccessToken.mockRejectedValue(
      new UnauthorizedError("Token expired", {
        details: { reason: "access_token_expired" },
      }),
    );

    const middleware = createDeserializeUserMiddleware({ tokenService });
    await middleware(req, res, next);

    expect(res.locals.auth).toMatchObject({
      accessToken: undefined,
      accessTokenExpired: true,
      error: expect.objectContaining({ reason: "access_token_expired" }),
    });
    expect(next).toHaveBeenCalled();
  });
});
