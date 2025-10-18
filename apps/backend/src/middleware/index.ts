import compression from "compression";
import cookieParser from "cookie-parser";
import express from "express";
import type { Express } from "express";
import hpp from "hpp";

import type { ApplicationConfig } from "@lumi/types";

import { createSentryRequestMiddleware } from "../lib/sentry.js";
import { createDeserializeUserMiddleware } from "./auth/deserializeUser.js";
import { createCorsMiddleware } from "./cors.js";
import { createMetricsMiddleware } from "./metrics.js";
import { createRateLimiterBundle } from "./rateLimiter.js";
import { createRequestIdMiddleware } from "./requestId.js";
import { createRequestLoggingMiddleware } from "./requestLogger.js";
import { createSanitizationMiddleware } from "./sanitize.js";
import { createSecurityMiddleware } from "./security.js";

const BODY_SIZE_LIMIT = "10mb";
const COMPRESSION_THRESHOLD_BYTES = 1024;

export const registerMiddleware = (app: Express, config: ApplicationConfig): void => {
  app.use(createRequestIdMiddleware());
  app.use(createMetricsMiddleware());
  app.use(createSentryRequestMiddleware());

  const securityMiddlewares = createSecurityMiddleware(config.security.headers);
  securityMiddlewares.forEach((middleware) => app.use(middleware));

  const corsBundle = createCorsMiddleware(config.security.cors);
  app.use(corsBundle.middleware);
  app.options("*", corsBundle.preflight);

  const rateLimiterBundle = createRateLimiterBundle(config.security.rateLimit);
  app.use(rateLimiterBundle.global);
  app.use("/api/v1/auth", rateLimiterBundle.auth);
  app.set("rateLimiterCleanup", rateLimiterBundle.cleanup);

  app.use(hpp());

  app.use(express.json({ limit: BODY_SIZE_LIMIT }));
  app.use(
    express.urlencoded({
      extended: true,
      limit: BODY_SIZE_LIMIT,
    }),
  );

  app.use(cookieParser());
  app.use(
    compression({
      threshold: COMPRESSION_THRESHOLD_BYTES,
    }),
  );

  const sanitizationMiddleware = createSanitizationMiddleware(config.security.validation);
  sanitizationMiddleware.forEach((middleware) => app.use(middleware));

  app.use(createDeserializeUserMiddleware());

  const requestLogger = createRequestLoggingMiddleware(config);

  app.use(requestLogger);
};
