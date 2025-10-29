import type { RequestHandler } from "express";
import mongoSanitize from "express-mongo-sanitize";
import xssClean from "xss-clean";

import type { ApplicationConfig } from "@lumi/types";

import { logger } from "../lib/logger.js";

const normaliseRequestQuery: RequestHandler = (req, _res, next) => {
  const originalQuery = req.query;
  if (originalQuery && typeof originalQuery === "object") {
    try {
      Object.defineProperty(req, "query", {
        value: { ...(originalQuery as Record<string, unknown>) },
        writable: true,
        configurable: true,
        enumerable: true,
      });
    } catch (error) {
      logger.debug("Unable to override request query descriptor for sanitization", {
        error,
      });
    }
  }
  next();
};

export const createSanitizationMiddleware = (
  validationConfig: ApplicationConfig["security"]["validation"],
): RequestHandler[] => {
  if (!validationConfig.sanitize) {
    return [];
  }

  const mongoSanitizer = mongoSanitize({
    allowDots: true,
    replaceWith: "_",
    onSanitize({ key }) {
      logger.warn("Detected and sanitized potentially malicious payload", {
        key,
      });
    },
  });

  const xssSanitizer = xssClean({
    allowList: {},
  }) as RequestHandler;

  return [normaliseRequestQuery, mongoSanitizer, xssSanitizer];
};
