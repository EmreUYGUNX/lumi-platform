import type { RequestHandler } from "express";
import mongoSanitize from "express-mongo-sanitize";
import sanitizeHtml from "sanitize-html";
import validator from "validator";
import xssClean from "xss-clean";

import type { ApplicationConfig } from "@lumi/types";

import { logger } from "../lib/logger.js";

const HTML_FIELD_PATTERN = /(description|content|message|notes|summary|bio|comment|details)$/iu;
const URL_FIELD_PATTERN = /(url|uri|link|website|avatar|image|webhook)$/iu;
const SEARCH_FIELD_PATTERN = /(search|query|keyword|term)$/iu;
const RESERVED_QUERY_CHARACTERS = /[^\p{L}\p{N}\s\-_.]/gu;

const normaliseWhitespace = (value: string): string => value.replaceAll(/\s+/gu, " ").trim();

const sanitiseUrlValue = (value: string): string => {
  const trimmed = validator.trim(value);
  if (trimmed.length === 0) {
    return trimmed;
  }

  const toUrlString = (candidate: string): string | undefined => {
    if (!validator.isURL(candidate, { require_protocol: true, protocols: ["http", "https"] })) {
      return undefined;
    }
    try {
      return new URL(candidate).toString();
    } catch {
      return undefined;
    }
  };

  const direct = toUrlString(trimmed);
  if (direct) {
    return direct;
  }

  const encoded = encodeURI(trimmed);
  const encodedResult = toUrlString(encoded);
  if (encodedResult) {
    return encodedResult;
  }

  return "";
};

const escapeQueryValue = (value: string): string =>
  normaliseWhitespace(value.replaceAll(/-{2,}/gu, " ").replaceAll(RESERVED_QUERY_CHARACTERS, " "));

const shouldStripHtml = (key?: string): boolean => (key ? HTML_FIELD_PATTERN.test(key) : false);
const shouldSanitiseUrl = (key?: string): boolean => (key ? URL_FIELD_PATTERN.test(key) : false);
const shouldNormaliseQuery = (key?: string): boolean =>
  key ? SEARCH_FIELD_PATTERN.test(key) : false;

const sanitiseStringValue = (value: string, key?: string): string => {
  let result = validator.stripLow(validator.trim(value), true);

  if (shouldStripHtml(key)) {
    result = sanitizeHtml(result, {
      allowedTags: [],
      allowedAttributes: {},
      textFilter: (text: string) => text,
    });
  }

  if (shouldSanitiseUrl(key)) {
    result = sanitiseUrlValue(result);
  } else if (shouldNormaliseQuery(key)) {
    result = escapeQueryValue(result);
  } else {
    result = normaliseWhitespace(result);
  }

  return result;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;

const sanitisePayload = (value: unknown, key?: string): unknown => {
  if (typeof value === "string") {
    return sanitiseStringValue(value, key);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitisePayload(item, key));
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        sanitisePayload(entryValue, entryKey),
      ]),
    );
  }

  return value;
};

const payloadSanitizerHandler: RequestHandler = (req, _res, next) => {
  if (req.body && typeof req.body === "object") {
    req.body = sanitisePayload(req.body) as typeof req.body;
  }

  if (req.query && typeof req.query === "object") {
    req.query = sanitisePayload(req.query) as typeof req.query;
  }

  if (req.params && typeof req.params === "object") {
    req.params = sanitisePayload(req.params) as typeof req.params;
  }

  next();
};

const createPayloadSanitizer = (): RequestHandler => payloadSanitizerHandler;

export const createSanitizationMiddleware = (
  validationConfig: ApplicationConfig["security"]["validation"],
): RequestHandler[] => {
  if (!validationConfig.sanitize) {
    return [];
  }

  const mongoSanitizerCore = mongoSanitize({
    allowDots: true,
    replaceWith: "_",
    onSanitize({ key }) {
      logger.warn("Detected and sanitized potentially malicious payload", {
        key,
      });
    },
  });

  const mongoSanitizer: RequestHandler = (req, res, next) => {
    const originalQuery = req.query;
    if (originalQuery && typeof originalQuery === "object" && !Array.isArray(originalQuery)) {
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

    return mongoSanitizerCore(req, res, next);
  };

  const xssSanitizer = xssClean({
    allowList: {},
  }) as RequestHandler;

  const payloadSanitizer = createPayloadSanitizer();

  return [mongoSanitizer, xssSanitizer, payloadSanitizer];
};
