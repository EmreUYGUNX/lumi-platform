import type { Prisma } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

import { ApiError, isClientErrorStatus } from "../errors/api-error.js";
import { logError, logger, mergeRequestContext } from "../lib/logger.js";
import { getSentryInstance, isSentryEnabled } from "../observability/sentry.js";
import { formatError } from "./response-formatter.js";

type PrismaKnownError = Prisma.PrismaClientKnownRequestError;
type PrismaValidationError = Prisma.PrismaClientValidationError;

const isObject = (input: unknown): input is Record<string, unknown> =>
  typeof input === "object" && input !== null;

const isPrismaKnownError = (error: unknown): error is PrismaKnownError =>
  isObject(error) && typeof error.code === "string" && "clientVersion" in error;

const isPrismaValidationError = (error: unknown): error is PrismaValidationError =>
  isObject(error) && error.name === "PrismaClientValidationError";

const PRISMA_ERROR_CODE_MAP: Record<
  string,
  {
    status: number;
    code: string;
    message: string;
    detailBuilder?: (error: PrismaKnownError) => string;
  }
> = {
  P2000: {
    status: 400,
    code: "INVALID_VALUE",
    message: "One or more fields exceed the allowed length.",
  },
  P2001: {
    status: 404,
    code: "RESOURCE_NOT_FOUND",
    message: "The requested record could not be found.",
  },
  P2002: {
    status: 409,
    code: "UNIQUE_CONSTRAINT_VIOLATION",
    message: "A resource with the provided identifier already exists.",
    detailBuilder: (error) => {
      const target = Array.isArray(error.meta?.target) ? error.meta?.target.join(", ") : undefined;
      return target ? `Unique constraint failed on: ${target}` : error.message;
    },
  },
  P2003: {
    status: 409,
    code: "FOREIGN_KEY_CONSTRAINT_FAILED",
    message: "The referenced resource does not exist.",
  },
  P2025: {
    status: 404,
    code: "RESOURCE_NOT_FOUND",
    message: "The requested resource does not exist.",
  },
};

const mapPrismaKnownError = (error: PrismaKnownError): ApiError => {
  const mapping = PRISMA_ERROR_CODE_MAP[error.code];

  if (!mapping) {
    return new ApiError("Database operation failed", {
      status: 500,
      code: "DATABASE_ERROR",
      cause: error,
    });
  }

  const details = mapping.detailBuilder ? [{ message: mapping.detailBuilder(error) }] : undefined;

  return new ApiError(mapping.message, {
    status: mapping.status,
    code: mapping.code,
    details,
    cause: error,
  });
};

const mapPrismaValidationError = (error: PrismaValidationError): ApiError =>
  new ApiError("Database validation failed", {
    status: 400,
    code: "DATABASE_VALIDATION_ERROR",
    details: [{ message: error.message }],
    cause: error,
  });

const mapZodError = (error: ZodError): ApiError =>
  new ApiError("Validation failed", {
    status: 422,
    code: "VALIDATION_ERROR",
    details: error.issues.map((issue) => ({
      field: issue.path.join(".") || undefined,
      message: issue.message,
    })),
    cause: error,
  });

const enrichLoggerContext = (req: Request, requestId: string) => {
  mergeRequestContext({
    requestId,
    userId: req.user?.id,
    role: req.user?.role,
    route: req.originalUrl,
  });
};

const mapPlainObjectError = (error: Record<string, unknown>): ApiError | undefined => {
  const { status, statusCode, code, message, details } = error as {
    status?: unknown;
    statusCode?: unknown;
    code?: unknown;
    message?: unknown;
    details?: unknown;
  };

  const statusCandidate = typeof status === "number" ? status : statusCode;

  if (typeof statusCandidate !== "number") {
    return undefined;
  }

  const resolvedCode = typeof code === "string" ? code : undefined;
  const resolvedMessage =
    typeof message === "string" && message.length > 0 ? message : "Unexpected error occurred";
  const resolvedDetails = Array.isArray(details) ? details : undefined;

  return new ApiError(resolvedMessage, {
    status: statusCandidate,
    code: resolvedCode,
    details: resolvedDetails,
  });
};

const normaliseError = (error: unknown): ApiError => {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof ZodError) {
    return mapZodError(error);
  }

  if (isPrismaKnownError(error)) {
    return mapPrismaKnownError(error);
  }

  if (isPrismaValidationError(error)) {
    return mapPrismaValidationError(error);
  }

  if (isObject(error)) {
    const mapped = mapPlainObjectError(error);
    if (mapped) {
      return mapped;
    }
  }

  return ApiError.fromUnknown(error);
};

export const errorHandler = (
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const requestId = res.requestId ?? req.requestId ?? "unknown";

  enrichLoggerContext(req, requestId);

  const normalised = normaliseError(error);

  const logPayload = {
    error,
    status: normalised.status,
    code: normalised.code,
    path: req.originalUrl,
    method: req.method,
    requestId,
  };

  if (normalised.status >= 500) {
    logError(error, normalised.message, logPayload);
  } else {
    logger.log(normalised.logLevel, normalised.message, logPayload);
  }

  if (isSentryEnabled() && !isClientErrorStatus(normalised.status)) {
    const sentry = getSentryInstance();
    sentry.captureException(error instanceof Error ? error : new Error(String(error)), {
      tags: {
        requestId,
        route: req.originalUrl,
      },
      extra: logPayload,
    });
  }

  const meta = {
    requestId,
  };

  if (typeof res.error === "function") {
    res.status(normalised.status);
    res.error(
      {
        code: normalised.code,
        message: normalised.message,
        details: normalised.details,
      },
      meta,
    );
    return;
  }

  res
    .status(normalised.status)
    .json(
      formatError(
        { code: normalised.code, message: normalised.message, details: normalised.details },
        meta,
      ),
    );
};
