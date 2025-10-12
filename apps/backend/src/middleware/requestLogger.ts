/* eslint-disable sonarjs/cognitive-complexity -- Serialisation and logging workflows require branching. */

/* eslint-disable security/detect-object-injection -- Logging sanitisation only inspects trusted key sets. */
import type { NextFunction, Request, RequestHandler, Response } from "express";

import type { ApplicationConfig, RequestLoggingConfig } from "@lumi/types";

import { logError, logger, mergeRequestContext } from "../lib/logger.js";

type CompletionEvent = "finish" | "close" | "error";

const REQUEST_LOGGER_ERROR_KEY = "requestLoggerError";
const MAX_SERIALISATION_DEPTH = 5;
const TRUNCATION_SUFFIX = "...";
const COMPLETION_MESSAGE = "HTTP request completed";
const CLIENT_ERROR_MESSAGE = "HTTP request completed with client error";
const FAILURE_MESSAGE = "HTTP request failed";

interface RequestLoggingMiddlewareOptions {
  logger?: Pick<typeof logger, "info" | "warn" | "error">;
  logError?: typeof logError;
}

interface SerialisedPayload {
  serialised: string;
  truncated: boolean;
  redactedFields: string[];
}

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return undefined;
};

const sanitiseValue = (
  value: unknown,
  sensitive: Set<string>,
  redacted: Set<string>,
  seen: WeakSet<object>,
  depth: number,
): unknown => {
  if (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "symbol") {
    return value.toString();
  }

  if (typeof value === "function") {
    return "[Function]";
  }

  if (Buffer.isBuffer(value)) {
    return `[binary:${value.length} bytes]`;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (depth >= MAX_SERIALISATION_DEPTH) {
    return "[DepthExceeded]";
  }

  if (typeof value === "object") {
    const objectValue = value as Record<string, unknown>;
    if (seen.has(objectValue)) {
      return "[Circular]";
    }

    seen.add(objectValue);

    if (Array.isArray(objectValue)) {
      const sanitisedArray = objectValue.map((entry) =>
        sanitiseValue(entry, sensitive, redacted, seen, depth + 1),
      );
      seen.delete(objectValue);
      return sanitisedArray;
    }

    if (value instanceof Map) {
      const mapResult: Record<string, unknown> = {};
      (value as Map<unknown, unknown>).forEach((mapValue, mapKey) => {
        let key: string;
        if (typeof mapKey === "string") {
          key = mapKey;
        } else {
          try {
            key = JSON.stringify(sanitiseValue(mapKey, sensitive, redacted, seen, depth + 1));
          } catch {
            key = "[non-serializable-key]";
          }
        }

        mapResult[key] = sanitiseValue(mapValue, sensitive, redacted, seen, depth + 1);
      });

      seen.delete(objectValue);
      return mapResult;
    }

    if (value instanceof Set) {
      const setValues = [...(value as Set<unknown>)].map((entry) =>
        sanitiseValue(entry, sensitive, redacted, seen, depth + 1),
      );
      seen.delete(objectValue);
      return setValues;
    }

    const result: Record<string, unknown> = {};
    Object.entries(objectValue).forEach(([key, nestedValue]) => {
      const normalisedKey = key.toLowerCase();
      if (sensitive.has(normalisedKey)) {
        redacted.add(normalisedKey);
        result[key] = "[REDACTED]";
        return;
      }
      result[key] = sanitiseValue(nestedValue, sensitive, redacted, seen, depth + 1);
    });

    seen.delete(objectValue);
    return result;
  }

  return String(value);
};

const serialisePayload = (
  payload: unknown,
  config: RequestLoggingConfig,
): SerialisedPayload | undefined => {
  if (payload === undefined || payload === null) {
    return undefined;
  }

  if (typeof payload === "string") {
    const trimmed = payload.trim();
    if (!trimmed) {
      return undefined;
    }
    const truncated = trimmed.length > config.maxBodyLength;
    return {
      serialised: truncated
        ? `${trimmed.slice(0, config.maxBodyLength)}${TRUNCATION_SUFFIX}`
        : trimmed,
      truncated,
      redactedFields: [],
    };
  }

  if (typeof payload !== "object") {
    const serialised = String(payload);
    return {
      serialised:
        serialised.length > config.maxBodyLength
          ? `${serialised.slice(0, config.maxBodyLength)}${TRUNCATION_SUFFIX}`
          : serialised,
      truncated: serialised.length > config.maxBodyLength,
      redactedFields: [],
    };
  }

  if (Buffer.isBuffer(payload)) {
    return {
      serialised: `[binary:${payload.length} bytes]`,
      truncated: false,
      redactedFields: [],
    };
  }

  const sensitive = new Set(config.redactFields.map((entry) => entry.toLowerCase()));
  const redacted = new Set<string>();
  const seen = new WeakSet<object>();

  const snapshot = sanitiseValue(payload, sensitive, redacted, seen, 0);

  let serialised: string;
  try {
    serialised = JSON.stringify(snapshot);
  } catch {
    return {
      serialised: "[Unserializable]",
      truncated: false,
      redactedFields: [...redacted],
    };
  }

  if ((serialised === "{}" || serialised === "[]") && redacted.size === 0) {
    return undefined;
  }

  const truncated = serialised.length > config.maxBodyLength;
  return {
    serialised: truncated
      ? `${serialised.slice(0, config.maxBodyLength)}${TRUNCATION_SUFFIX}`
      : serialised,
    truncated,
    redactedFields: [...redacted],
  };
};

const getCapturedError = (response: Response): unknown =>
  response.locals[REQUEST_LOGGER_ERROR_KEY] ??
  response.locals.error ??
  response.locals.err ??
  response.locals.exception;

const resolveConfig = (request: Request, fallback: ApplicationConfig): ApplicationConfig =>
  (request.app?.locals?.config as ApplicationConfig | undefined) ?? fallback;

const resolveSampleDecision = (sampleRate: number) => {
  if (sampleRate >= 1) {
    return true;
  }

  if (sampleRate <= 0) {
    return false;
  }

  return Math.random() < sampleRate;
};

const normaliseStatusCode = (
  response: Response,
  event: CompletionEvent,
  error?: unknown,
): number => {
  if (response.statusCode && response.statusCode > 0) {
    return response.statusCode;
  }

  if (event === "close") {
    return 499;
  }

  if (error) {
    return 500;
  }

  return 200;
};

const resolveCorrelationId = (request: Request, response: Response): string | undefined =>
  (request.id as string | undefined) ?? (response.locals.requestId as string | undefined);

export const captureRequestError = (response: Response, error: unknown): void => {
  response.locals[REQUEST_LOGGER_ERROR_KEY] = error;
};

export const createRequestLoggingMiddleware = (
  initialConfig: ApplicationConfig,
  options: RequestLoggingMiddlewareOptions = {},
): RequestHandler => {
  const activeLogger = options.logger ?? logger;
  const errorLogger = options.logError ?? logError;

  return (request: Request, response: Response, next: NextFunction) => {
    const activeConfig = resolveConfig(request, initialConfig);
    const loggingConfig = activeConfig.observability.logs.request;

    const sampleDecision = resolveSampleDecision(loggingConfig.sampleRate);
    const startTime = process.hrtime.bigint();

    const correlationId = resolveCorrelationId(request, response);
    if (correlationId) {
      mergeRequestContext({ correlationId });
    }

    const userAgent = request.get("user-agent") ?? "unknown";
    const requestContentLength = toNumber(request.get("content-length"));

    let completed = false;

    const finalize = (event: CompletionEvent, emittedError?: unknown) => {
      if (completed) {
        return;
      }

      completed = true;

      try {
        const statusCode = normaliseStatusCode(response, event, emittedError);
        const elapsed = Number(process.hrtime.bigint() - startTime) / 1_000_000;
        const durationMs = Math.round(elapsed * 100) / 100;

        const metadata: Record<string, unknown> = {
          method: request.method,
          path: request.originalUrl ?? request.url,
          statusCode,
          durationMs,
          ip: request.ip,
          userAgent,
          sampled: sampleDecision,
          httpVersion: request.httpVersion ? `HTTP/${request.httpVersion}` : undefined,
        };

        if (!metadata.httpVersion) {
          delete metadata.httpVersion;
        }

        if (correlationId) {
          metadata.correlationId = correlationId;
        }

        if (event !== "finish") {
          metadata.lifecycle = event;
        }

        if (request.baseUrl) {
          metadata.baseUrl = request.baseUrl;
        }

        if (request.route?.path) {
          metadata.route = request.route.path;
        }

        if (requestContentLength !== undefined) {
          metadata.requestContentLength = requestContentLength;
        }

        const responseLength = toNumber(response.getHeader("content-length"));
        if (responseLength !== undefined) {
          metadata.responseContentLength = responseLength;
        }

        const capturedError = emittedError ?? getCapturedError(response);
        const shouldLog =
          statusCode >= 400 || Boolean(capturedError) || (sampleDecision && statusCode < 400);

        if (!shouldLog) {
          return;
        }

        const serialisedBody = serialisePayload(request.body, loggingConfig);
        if (serialisedBody) {
          metadata.requestBody = serialisedBody.serialised;
          if (serialisedBody.truncated) {
            metadata.requestBodyTruncated = true;
          }
          if (serialisedBody.redactedFields.length > 0) {
            metadata.redactedFields = serialisedBody.redactedFields;
          }
        }

        if (capturedError || statusCode >= 500) {
          if (!capturedError && statusCode >= 500) {
            metadata.missingError = true;
          }

          errorLogger(capturedError ?? new Error(`HTTP ${statusCode}`), FAILURE_MESSAGE, metadata);
          return;
        }

        if (statusCode >= 400) {
          activeLogger.warn(CLIENT_ERROR_MESSAGE, metadata);
          return;
        }

        activeLogger.info(COMPLETION_MESSAGE, metadata);
      } catch (loggingError) {
        // eslint-disable-next-line no-console
        console.error("Request logging middleware failed", loggingError);
      }
    };

    response.once("finish", () => finalize("finish"));
    response.once("close", () => finalize("close"));
    response.once("error", (error) => finalize("error", error));

    next();
  };
};
