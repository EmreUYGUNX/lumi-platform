/* eslint-disable max-classes-per-file */
import { inspect } from "node:util";

export const ERROR_CODES = {
  VALIDATION: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  METHOD_NOT_ALLOWED: "METHOD_NOT_ALLOWED",
  CONFLICT: "CONFLICT",
  INTERNAL: "INTERNAL_SERVER_ERROR",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export type ErrorDetails = Record<string, unknown>;

export interface AppErrorOptions<TDetails extends ErrorDetails | undefined = ErrorDetails> {
  code?: ErrorCode;
  cause?: unknown;
  details?: TDetails;
  /**
   * Operational errors represent expected failure modes (e.g. validation failures)
   * that can be handled gracefully. Non-operational errors indicate programmer bugs.
   */
  isOperational?: boolean;
  /**
   * Controls whether the `details` payload is safe to include in responses.
   */
  exposeDetails?: boolean;
}

const DEFAULT_STATUS_CODE = 500;
const DEFAULT_MESSAGE = "An unexpected error occurred.";

export class AppError<TDetails extends ErrorDetails | undefined = ErrorDetails> extends Error {
  readonly statusCode: number;

  readonly code: ErrorCode;

  readonly details?: TDetails;

  readonly isOperational: boolean;

  readonly exposeDetails: boolean;

  constructor(
    message: string = DEFAULT_MESSAGE,
    statusCode: number = DEFAULT_STATUS_CODE,
    options: AppErrorOptions<TDetails> = {},
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = options.code ?? ERROR_CODES.INTERNAL;
    this.details = options.details;
    this.isOperational = options.isOperational ?? statusCode < 500;
    this.exposeDetails = options.exposeDetails ?? false;

    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

export interface ValidationErrorDetail {
  path: string;
  message: string;
  code?: string;
}

export interface ValidationErrorOptions
  extends AppErrorOptions<{ issues: ValidationErrorDetail[] }> {
  issues?: ValidationErrorDetail[];
}

export class ValidationError extends AppError<{ issues: ValidationErrorDetail[] }> {
  constructor(message?: string, options: ValidationErrorOptions = {}) {
    super(message ?? "Validation failed.", 400, {
      ...options,
      code: options.code ?? ERROR_CODES.VALIDATION,
      details: { issues: options.issues ?? options.details?.issues ?? [] },
      isOperational: options.isOperational ?? true,
      exposeDetails: options.exposeDetails ?? true,
    });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message?: string, options: AppErrorOptions = {}) {
    super(message ?? "Authentication required.", 401, {
      ...options,
      code: options.code ?? ERROR_CODES.UNAUTHORIZED,
      isOperational: options.isOperational ?? true,
    });
  }
}

export class ForbiddenError extends AppError {
  constructor(message?: string, options: AppErrorOptions = {}) {
    super(message ?? "You do not have permission to perform this action.", 403, {
      ...options,
      code: options.code ?? ERROR_CODES.FORBIDDEN,
      isOperational: options.isOperational ?? true,
    });
  }
}

export class NotFoundError extends AppError {
  constructor(message?: string, options: AppErrorOptions = {}) {
    super(message ?? "Resource not found.", 404, {
      ...options,
      code: options.code ?? ERROR_CODES.NOT_FOUND,
      isOperational: options.isOperational ?? true,
    });
  }
}

export class MethodNotAllowedError extends AppError {
  constructor(message?: string, options: AppErrorOptions = {}) {
    super(message ?? "Method not allowed on this resource.", 405, {
      ...options,
      code: options.code ?? ERROR_CODES.METHOD_NOT_ALLOWED,
      isOperational: options.isOperational ?? true,
    });
  }
}

export class ConflictError extends AppError {
  constructor(message?: string, options: AppErrorOptions = {}) {
    super(message ?? "Conflict with the current state of the resource.", 409, {
      ...options,
      code: options.code ?? ERROR_CODES.CONFLICT,
      isOperational: options.isOperational ?? true,
    });
  }
}

export class InternalServerError extends AppError {
  constructor(message?: string, options: AppErrorOptions = {}) {
    super(message ?? "Internal server error.", 500, {
      ...options,
      code: options.code ?? ERROR_CODES.INTERNAL,
      isOperational: options.isOperational ?? false,
      exposeDetails: options.exposeDetails ?? false,
    });
  }
}

export const isAppError = (error: unknown): error is AppError => error instanceof AppError;

export const isValidationError = (error: unknown): error is ValidationError =>
  error instanceof ValidationError;

export const isUnauthorizedError = (error: unknown): error is UnauthorizedError =>
  error instanceof UnauthorizedError;

export const isForbiddenError = (error: unknown): error is ForbiddenError =>
  error instanceof ForbiddenError;

export const isNotFoundError = (error: unknown): error is NotFoundError =>
  error instanceof NotFoundError;

export const isConflictError = (error: unknown): error is ConflictError =>
  error instanceof ConflictError;

export const isInternalServerError = (error: unknown): error is InternalServerError =>
  error instanceof InternalServerError;

export const normaliseUnknownError = (error: unknown): Error => {
  if (error instanceof Error) {
    return error;
  }

  const formatted = inspect(error, { depth: 3 });
  return new Error(formatted);
};
