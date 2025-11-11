import { randomUUID } from "node:crypto";

import type { NextFunction, Request, Response } from "express";

const REQUEST_ID_HEADER = "x-request-id";

export interface ResponseMeta {
  timestamp: string;
  requestId: string;
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

const isObject = (input: unknown): input is Record<string, unknown> =>
  typeof input === "object" && input !== null;

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

const buildMeta = (requestId: string, meta?: Record<string, unknown>): ResponseMeta => {
  const timestamp = new Date().toISOString();
  const { requestId: metaRequestId, ...rest } = (meta ?? {}) as Record<string, unknown> & {
    requestId?: string;
  };
  const resolvedRequestId =
    typeof metaRequestId === "string" && metaRequestId.length > 0 ? metaRequestId : requestId;

  return {
    ...rest,
    timestamp,
    requestId: resolvedRequestId,
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

const hasValidMeta = (meta: unknown): boolean => {
  return meta === undefined || isObject(meta);
};

const isFormattedResponse = (payload: unknown): payload is ApiResponse => {
  if (!isObject(payload)) {
    return false;
  }

  if (payload.success === true) {
    return "data" in payload && hasValidMeta(payload.meta);
  }

  if (payload.success === false) {
    return (
      hasValidMeta(payload.meta) &&
      isObject(payload.error) &&
      typeof (payload.error as { code?: unknown }).code === "string"
    );
  }

  return false;
};

const ensureRequestMetadata = <T extends ApiResponse>(payload: T, requestId: string): T => {
  const meta = (payload.meta ?? undefined) as Record<string, unknown> | undefined;
  const updatedMeta: ResponseMeta = buildMeta(requestId, meta);

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
  const inheritedRequestId =
    (typeof req.id === "string" && req.id.length > 0 ? req.id : undefined) ||
    (headerRequestId && headerRequestId.length > 0 ? headerRequestId : undefined);
  const requestId = inheritedRequestId ?? randomUUID();

  req.id = requestId;
  req.requestId = requestId;
  res.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);

  const originalJson = attachHelpers(res, requestId);

  res.json = (payload: unknown) => {
    if (res.locals?.disableResponseFormatter) {
      return originalJson(payload);
    }

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
