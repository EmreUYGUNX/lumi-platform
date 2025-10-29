import type { NextFunction, Request, RequestHandler, Response } from "express";

import { isUnauthorizedError } from "@/lib/errors.js";
import { createChildLogger, mergeRequestContext } from "@/lib/logger.js";
import { type TokenService, createTokenService } from "@/modules/auth/token.service.js";
import type { AccessTokenClaims, RequestAuthState } from "@/modules/auth/token.types.js";

const ACCESS_TOKEN_HEADER = "authorization";
const DEFAULT_REFRESH_COOKIE = "refreshToken";
const AUTH_LOGGER = createChildLogger("middleware:auth:deserialize");
const BEARER_TOKEN_PATTERN = /^\s*bearer\s+(\S+)\s*$/i;
const SAFE_COOKIE_NAME_PATTERN = /^[\w-]+$/;

const toHeaderValue = (header: undefined | string | string[]): string | undefined => {
  if (!header) {
    return undefined;
  }

  if (Array.isArray(header)) {
    return header.length > 0 ? header[0] : undefined;
  }

  return header;
};

const extractBearerToken = (header?: string): string | undefined => {
  if (!header) {
    return undefined;
  }

  const match = header.match(BEARER_TOKEN_PATTERN);
  return match ? match[1] : undefined;
};

interface DeserializeUserOptions {
  tokenService?: TokenService;
  refreshCookieName?: string;
}

const buildAuthState = (
  tokenService: TokenService,
  accessToken: AccessTokenClaims | undefined,
  overrides: Partial<RequestAuthState>,
): RequestAuthState => tokenService.createRequestAuthState(accessToken, overrides);

export const createDeserializeUserMiddleware = (
  options: DeserializeUserOptions = {},
): RequestHandler => {
  const tokenService =
    options.tokenService ??
    createTokenService({
      disableCleanupJob: true,
    });
  const refreshCookieName = options.refreshCookieName ?? DEFAULT_REFRESH_COOKIE;

  return async (req: Request, res: Response, next: NextFunction) => {
    const { [ACCESS_TOKEN_HEADER]: authorization } = req.headers;
    const headerValue = toHeaderValue(authorization);
    const accessToken = extractBearerToken(headerValue);
    const signedCookieStore =
      req.signedCookies && typeof req.signedCookies === "object"
        ? (req.signedCookies as Record<string, unknown>)
        : {};
    const cookieStore =
      req.cookies && typeof req.cookies === "object"
        ? (req.cookies as Record<string, unknown>)
        : {};
    const cookiesMap = new Map<string, unknown>(Object.entries(cookieStore));
    Object.entries(signedCookieStore).forEach(([key, value]) => {
      cookiesMap.set(key, value);
    });
    const candidateCookieName = SAFE_COOKIE_NAME_PATTERN.test(refreshCookieName)
      ? refreshCookieName
      : DEFAULT_REFRESH_COOKIE;
    const refreshTokenValue = cookiesMap.get(candidateCookieName);
    const refreshToken =
      typeof refreshTokenValue === "string" ? (refreshTokenValue as string) : undefined;
    const refreshTokenPresent = Boolean(refreshToken);

    if (!accessToken) {
      res.locals.auth = buildAuthState(tokenService, undefined, {
        refreshToken,
        refreshTokenPresent,
      });
      next();
      return;
    }

    try {
      const claims = await tokenService.verifyAccessToken(accessToken);
      const user = await tokenService.fetchAuthenticatedUser(claims);

      req.user = user;
      res.locals.auth = buildAuthState(tokenService, claims, {
        refreshToken,
        refreshTokenPresent,
      });

      mergeRequestContext({
        userId: user.id,
        sessionId: user.sessionId,
        tokenId: claims.jti,
      });

      next();
    } catch (error) {
      if (!isUnauthorizedError(error)) {
        next(error);
        return;
      }

      const reason =
        (error.details && "reason" in error.details && typeof error.details.reason === "string"
          ? error.details.reason
          : undefined) ?? "unauthorized";

      AUTH_LOGGER.debug("Access token verification failed", {
        reason,
        message: error.message,
        path: req.originalUrl,
      });

      res.locals.auth = buildAuthState(tokenService, undefined, {
        refreshToken,
        refreshTokenPresent,
        accessTokenExpired: reason === "access_token_expired",
        error: {
          reason,
          message: error.message,
        },
      });

      next();
    }
  };
};
