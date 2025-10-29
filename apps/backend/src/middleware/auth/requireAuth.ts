import type { RequestHandler } from "express";

import { UnauthorizedError } from "@/lib/errors.js";
import { createChildLogger, mergeRequestContext } from "@/lib/logger.js";

const logger = createChildLogger("middleware:auth:require-auth");

const requireAuthHandler: RequestHandler = (req, _res, next) => {
  if (req.user) {
    mergeRequestContext({ userId: req.user.id });
    next();
    return;
  }

  const reason =
    (req.res?.locals?.auth?.error?.reason as string | undefined) ??
    (req.res?.locals?.auth?.accessTokenExpired ? "access_token_expired" : "unauthenticated");

  logger.warn("Unauthenticated request blocked", {
    method: req.method,
    path: req.originalUrl,
    requestId: req.id,
    reason,
  });

  next(
    new UnauthorizedError("Authentication required.", {
      details: { reason },
    }),
  );
};

export const createRequireAuthMiddleware = (): RequestHandler => requireAuthHandler;
