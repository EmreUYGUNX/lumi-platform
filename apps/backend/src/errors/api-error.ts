import type { ErrorDetail } from "../middleware/response-formatter.js";

export type ErrorLogLevel = "fatal" | "error" | "warn" | "info" | "debug" | "trace";

export interface ApiErrorOptions {
  status?: number;
  code?: string;
  details?: ErrorDetail[];
  cause?: unknown;
  logLevel?: ErrorLogLevel;
}

const resolveErrorIdentifier = (status: number, explicit?: string) => {
  if (explicit) {
    return explicit.toUpperCase();
  }

  switch (status) {
    case 400: {
      return "BAD_REQUEST";
    }
    case 401: {
      return "UNAUTHORIZED";
    }
    case 403: {
      return "FORBIDDEN";
    }
    case 404: {
      return "NOT_FOUND";
    }
    case 409: {
      return "CONFLICT";
    }
    case 410: {
      return "GONE";
    }
    case 412: {
      return "PRECONDITION_FAILED";
    }
    case 413: {
      return "PAYLOAD_TOO_LARGE";
    }
    case 415: {
      return "UNSUPPORTED_MEDIA_TYPE";
    }
    case 422: {
      return "VALIDATION_ERROR";
    }
    case 429: {
      return "RATE_LIMITED";
    }
    case 502: {
      return "BAD_GATEWAY";
    }
    case 503: {
      return "SERVICE_UNAVAILABLE";
    }
    case 504: {
      return "GATEWAY_TIMEOUT";
    }
    default: {
      return "INTERNAL_SERVER_ERROR";
    }
  }
};

export class ApiError extends Error {
  public readonly status: number;

  public readonly code: string;

  public readonly details?: ErrorDetail[];

  public readonly logLevel: ErrorLogLevel;

  constructor(message: string, options: ApiErrorOptions = {}) {
    const status = options.status ?? 500;
    super(message);

    this.status = status;
    this.code = resolveErrorIdentifier(status, options.code);
    this.details = options.details;
    this.logLevel = options.logLevel ?? (status >= 500 ? "error" : "warn");

    if (options.cause) {
      this.cause = options.cause;
    }

    Error.captureStackTrace?.(this, ApiError);
  }

  static fromUnknown(error: unknown, fallback?: Partial<ApiErrorOptions>): ApiError {
    if (error instanceof ApiError) {
      return error;
    }

    if (error instanceof Error) {
      return new ApiError(error.message || "Unexpected error occurred", {
        ...fallback,
        status: fallback?.status ?? 500,
        code: fallback?.code,
        cause: error,
      });
    }

    return new ApiError("Unexpected error occurred", {
      ...fallback,
      status: fallback?.status ?? 500,
      code: fallback?.code,
    });
  }
}

export const isClientErrorStatus = (status: number): boolean => status >= 400 && status < 500;
