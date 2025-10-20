import { randomBytes } from "node:crypto";

import cookieParser from "cookie-parser";
import type { RequestHandler } from "express";

import { createChildLogger } from "@/lib/logger.js";
// eslint-disable-next-line import/order -- Prettier sorts type-only imports separately.
import type { ApplicationConfig } from "@lumi/types";

interface CsrfMiddlewareBundle {
  issueToken: RequestHandler;
  validate: RequestHandler;
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const DEFAULT_COOKIE_NAME = "csrfToken";
const DEFAULT_HEADER_NAME = "x-csrf-token";

const logger = createChildLogger("middleware:security:csrf");

const shouldValidateRequest = (req: Parameters<RequestHandler>[0]): boolean => {
  if (SAFE_METHODS.has(req.method)) {
    return false;
  }

  const { authorization } = req.headers;
  if (authorization && authorization.toLowerCase().startsWith("bearer ")) {
    return false;
  }

  const cookies = req.cookies ?? {};
  return Boolean(typeof cookies.refreshToken === "string");
};

const resolveCookieToken = (
  req: Parameters<RequestHandler>[0],
  cookieName: string,
): string | undefined => {
  const cookies = req.cookies ?? {};
  // eslint-disable-next-line security/detect-object-injection -- Cookie name is a controlled constant.
  const token = cookies?.[cookieName];
  return typeof token === "string" ? token : undefined;
};

const resolveHeaderToken = (
  req: Parameters<RequestHandler>[0],
  headerName: string,
): string | undefined => {
  // eslint-disable-next-line security/detect-object-injection -- Header name is a controlled constant.
  const direct = req.headers[headerName];
  if (typeof direct === "string") {
    return direct;
  }
  if (Array.isArray(direct) && direct.length > 0) {
    return direct[0];
  }
  return req.get(headerName) ?? undefined;
};

export const createCsrfMiddleware = (
  config: ApplicationConfig,
  options: {
    cookieName?: string;
    headerName?: string;
  } = {},
): CsrfMiddlewareBundle => {
  const cookieName = options.cookieName ?? DEFAULT_COOKIE_NAME;
  const headerName = (options.headerName ?? DEFAULT_HEADER_NAME).toLowerCase();
  const secureCookies = config.app.environment !== "development";
  const cookieDomain = config.auth.cookies.domain;

  const issueToken: RequestHandler = (req, res, next) => {
    let token = resolveCookieToken(req, cookieName);

    if (!token) {
      token = randomBytes(32).toString("hex");
      res.cookie(cookieName, token, {
        httpOnly: false,
        secure: secureCookies,
        sameSite: "strict",
        domain: cookieDomain,
        path: "/",
      });
    }

    res.locals.csrfToken = token;
    next();
  };

  const validate: RequestHandler = (req, res, next) => {
    if (!shouldValidateRequest(req)) {
      next();
      return;
    }

    const cookieToken = resolveCookieToken(req, cookieName);
    const headerToken = resolveHeaderToken(req, headerName);

    if (cookieToken && headerToken && cookieToken === headerToken) {
      next();
      return;
    }

    logger.warn("CSRF token validation failed", {
      path: req.originalUrl,
      method: req.method,
      hasCookieToken: Boolean(cookieToken),
      hasHeaderToken: Boolean(headerToken),
    });

    res.status(403).json({
      success: false,
      error: {
        code: "CSRF_TOKEN_INVALID",
        message: "Cross-site request forgery protection validation failed.",
      },
    });
  };

  return {
    issueToken,
    validate,
  };
};

export const createCookieAndCsrfMiddleware = (
  config: ApplicationConfig,
  options: {
    cookieName?: string;
    headerName?: string;
  } = {},
): RequestHandler => {
  const parser = cookieParser();
  const bundle = createCsrfMiddleware(config, options);

  const handler: RequestHandler = (req, res, next) => {
    parser(req, res, (parserError?: unknown) => {
      if (parserError) {
        next(parserError as Error);
        return;
      }

      bundle.issueToken(req, res, (issueError?: unknown) => {
        if (issueError) {
          next(issueError as Error);
          return;
        }

        bundle.validate(req, res, next);
      });
    });
  };

  return handler;
};
