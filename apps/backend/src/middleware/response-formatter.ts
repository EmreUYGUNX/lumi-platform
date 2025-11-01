import { randomUUID } from "node:crypto";

import type { NextFunction, Request, Response } from "express";

const REQUEST_ID_HEADER = "x-request-id";

export interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export interface ResponseMeta {
  timestamp: string;
  requestId: string;
  pagination?: PaginationMeta;
  [key: string]: unknown;
}

export interface SuccessResponse<TData = unknown> {
  success: true;
  data: TData;
  meta: ResponseMeta;
}

export interface ErrorDetail {
  field?: string;
  message: string;
  [key: string]: unknown;
}

export interface ErrorPayload {
  code: string;
  message: string;
  details?: ErrorDetail[];
}

export interface ErrorResponse {
  success: false;
  error: ErrorPayload;
  meta: ResponseMeta;
}

export type ApiResponse<TData = unknown> = SuccessResponse<TData> | ErrorResponse;

export interface PaginationInput {
  page: number;
  perPage: number;
  total: number;
}

const isObject = (input: unknown): input is Record<string, unknown> =>
  typeof input === "object" && input !== null;

const toNumber = (value: unknown, fallback: number) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
};

export const buildPaginationMeta = (input: PaginationInput): PaginationMeta => {
  const page = Math.max(1, Math.trunc(input.page));
  const perPage = Math.max(1, Math.trunc(input.perPage));
  const total = Math.max(0, Math.trunc(input.total));
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return {
    page,
    perPage,
    total,
    totalPages,
  };
};

const normalisePaginationMeta = (value: unknown): PaginationMeta | undefined => {
  if (!isObject(value)) {
    return undefined;
  }

  const page = toNumber(value.page, 1);
  const perPage = toNumber(value.perPage, 1);
  const total = toNumber(value.total, 0);

  return buildPaginationMeta({ page, perPage, total });
};

const buildDetailFromObject = (detail: Record<string, unknown>): ErrorDetail => {
  const { field, message, ...rest } = detail;
  return {
    ...(field && typeof field === "string" ? { field } : {}),
    message: typeof message === "string" && message.length > 0 ? message : "Validation error",
    ...rest,
  };
};

const normaliseErrorDetail = (detail: unknown): ErrorDetail | undefined => {
  if (typeof detail === "string") {
    return { message: detail };
  }

  if (isObject(detail)) {
    return buildDetailFromObject(detail);
  }

  if (detail === undefined || detail === null) {
    return undefined;
  }

  return { message: String(detail) };
};

const toErrorDetails = (value: unknown): ErrorDetail[] | undefined => {
  if (!value) {
    return undefined;
  }

  if (Array.isArray(value)) {
    const details = value
      .map((entry) => normaliseErrorDetail(entry))
      .filter(Boolean) as ErrorDetail[];
    return details.length > 0 ? details : undefined;
  }

  const detail = normaliseErrorDetail(value);
  return detail ? [detail] : undefined;
};

const buildMeta = (requestId: string, meta?: Partial<ResponseMeta>): ResponseMeta => {
  const timestamp = new Date().toISOString();
  const pagination = normalisePaginationMeta(meta?.pagination);

  return {
    ...meta,
    timestamp,
    requestId,
    ...(pagination ? { pagination } : {}),
  };
};

export const formatSuccess = <TData>(
  data: TData,
  meta?: Partial<ResponseMeta>,
): SuccessResponse<TData> => {
  const requestId = meta?.requestId ?? randomUUID();
  return {
    success: true,
    data,
    meta: buildMeta(requestId, meta),
  };
};

export interface ErrorInput {
  code: string;
  message: string;
  details?: unknown;
}

export const formatError = (error: ErrorInput, meta?: Partial<ResponseMeta>): ErrorResponse => {
  const requestId = meta?.requestId ?? randomUUID();
  const details = toErrorDetails(error.details);
  return {
    success: false,
    error: {
      code: error.code,
      message: error.message,
      ...(details ? { details } : {}),
    },
    meta: buildMeta(requestId, meta),
  };
};

const isFormattedResponse = (payload: unknown): payload is ApiResponse => {
  if (!isObject(payload)) {
    return false;
  }

  if (payload.success === true) {
    return "data" in payload && isObject(payload.meta);
  }

  if (payload.success === false) {
    return (
      isObject(payload.meta) && isObject(payload.error) && typeof payload.error.code === "string"
    );
  }

  return false;
};

const ensureRequestMetadata = <T extends ApiResponse>(payload: T, requestId: string): T => {
  const meta = payload.meta ?? ({} as ResponseMeta);
  const { requestId: metaRequestId, ...restMeta } = meta;
  const updatedMeta: ResponseMeta = buildMeta(metaRequestId ?? requestId, restMeta);

  return {
    ...payload,
    meta: updatedMeta,
  };
};

const extractExplicitError = (payload: unknown): ErrorResponse | undefined => {
  if (isFormattedResponse(payload) && payload.success === false) {
    return payload as ErrorResponse;
  }

  if (isObject(payload)) {
    const { code, message, details } = payload as {
      code?: unknown;
      message?: unknown;
      details?: unknown;
    };

    if (typeof code === "string") {
      return formatError(
        {
          code,
          message: typeof message === "string" ? message : "An unexpected error occurred",
          details,
        },
        {},
      );
    }
  }

  return undefined;
};

const buildFallbackError = (_payload: unknown): ErrorResponse => {
  return formatError(
    {
      code: "UNHANDLED_ERROR",
      message: "An unexpected error occurred",
    },
    {},
  );
};

const normaliseErrorResponse = (payload: unknown, requestId: string): ErrorResponse => {
  const explicit = extractExplicitError(payload);
  const errorResponse = explicit ?? buildFallbackError(payload);
  return ensureRequestMetadata(errorResponse, requestId);
};

const attachHelpers = (res: Response, requestId: string) => {
  const sendJson = res.json.bind(res);

  const sendSuccess = <TData>(data: TData, meta?: Partial<ResponseMeta>) =>
    sendJson(formatSuccess(data, { ...meta, requestId }));

  const sendError = (error: ErrorInput, meta?: Partial<ResponseMeta>) =>
    sendJson(formatError(error, { ...meta, requestId }));

  // eslint-disable-next-line no-param-reassign
  res.success = sendSuccess;
  // eslint-disable-next-line no-param-reassign
  res.error = sendError;

  return sendJson;
};

export const responseFormatter = (req: Request, res: Response, next: NextFunction): void => {
  const headerRequestId = req.get(REQUEST_ID_HEADER);
  const requestId = headerRequestId && headerRequestId.length > 0 ? headerRequestId : randomUUID();

  req.requestId = requestId;
  res.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);

  const originalJson = attachHelpers(res, requestId);

  res.json = (payload: unknown) => {
    if (isFormattedResponse(payload)) {
      return originalJson(ensureRequestMetadata(payload, requestId));
    }

    if (res.statusCode >= 400) {
      const errorPayload = normaliseErrorResponse(payload, requestId);
      return originalJson(errorPayload);
    }

    return originalJson(formatSuccess(payload, { requestId }));
  };

  res.locals.requestId = requestId;
  next();
};
