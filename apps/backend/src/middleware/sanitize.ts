import type { RequestHandler } from "express";
import mongoSanitize from "express-mongo-sanitize";
import xssClean from "xss-clean";

import type { ApplicationConfig } from "@lumi/types";

import { logger } from "../lib/logger.js";

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

  return [mongoSanitizer, xssSanitizer];
};
