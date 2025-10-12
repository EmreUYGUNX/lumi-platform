import { AppError, type ErrorCode, type ErrorDetails } from "./errors.js";

export interface ApiSuccessResponse<
  TData,
  TMeta extends Record<string, unknown> | undefined = undefined,
> {
  success: true;
  data: TData;
  meta?: TMeta;
}

export interface ApiErrorDetails<
  TCode extends string = string,
  TDetails extends ErrorDetails | undefined = ErrorDetails,
> {
  code: TCode;
  message: string;
  details?: TDetails;
}

export interface ApiErrorResponse<
  TCode extends string = string,
  TDetails extends ErrorDetails | undefined = ErrorDetails,
  TMeta extends Record<string, unknown> | undefined = undefined,
> {
  success: false;
  error: ApiErrorDetails<TCode, TDetails>;
  meta?: TMeta;
}

export type ApiResponse<
  TSuccessData,
  TSuccessMeta extends Record<string, unknown> | undefined = undefined,
  TErrorCode extends string = string,
  TErrorDetails extends ErrorDetails | undefined = ErrorDetails,
  TErrorMeta extends Record<string, unknown> | undefined = undefined,
> =
  | ApiSuccessResponse<TSuccessData, TSuccessMeta>
  | ApiErrorResponse<TErrorCode, TErrorDetails, TErrorMeta>;

export const successResponse = <
  TData,
  TMeta extends Record<string, unknown> | undefined = undefined,
>(
  data: TData,
  meta?: TMeta,
): ApiSuccessResponse<TData, TMeta> => {
  const response: ApiSuccessResponse<TData, TMeta> = {
    success: true as const,
    data,
  };

  if (meta !== undefined) {
    response.meta = meta;
  }

  return response;
};

export interface ErrorResponseInput<
  TCode extends string = string,
  TDetails extends ErrorDetails | undefined = ErrorDetails,
> {
  code: TCode;
  message: string;
  details?: TDetails;
}

const buildErrorResponse = <
  TCode extends string = string,
  TDetails extends ErrorDetails | undefined = ErrorDetails,
  TMeta extends Record<string, unknown> | undefined = undefined,
>(
  { code, message, details }: ErrorResponseInput<TCode, TDetails>,
  meta?: TMeta,
): ApiErrorResponse<TCode, TDetails, TMeta> => {
  const payload: ApiErrorResponse<TCode, TDetails, TMeta> = {
    success: false as const,
    error: {
      code,
      message,
    },
  };

  if (details !== undefined) {
    payload.error.details = details;
  }

  if (meta !== undefined) {
    payload.meta = meta;
  }

  return payload;
};

export function errorResponse<TDetails extends ErrorDetails | undefined>(
  error: AppError<TDetails>,
  meta?: Record<string, unknown>,
): ApiErrorResponse<ErrorCode, TDetails, Record<string, unknown> | undefined>;
export function errorResponse<
  TCode extends string,
  TDetails extends ErrorDetails | undefined = ErrorDetails,
  TMeta extends Record<string, unknown> | undefined = undefined,
>(
  input: ErrorResponseInput<TCode, TDetails>,
  meta?: TMeta,
): ApiErrorResponse<TCode, TDetails, TMeta>;
export function errorResponse<
  TCode extends string,
  TDetails extends ErrorDetails | undefined = ErrorDetails,
  TMeta extends Record<string, unknown> | undefined = undefined,
>(
  input: ErrorResponseInput<TCode, TDetails> | AppError<TDetails>,
  meta?: TMeta,
): ApiErrorResponse<TCode | ErrorCode, TDetails, TMeta | (Record<string, unknown> | undefined)> {
  if (input instanceof AppError) {
    const details = input.exposeDetails ? input.details : undefined;
    return buildErrorResponse(
      {
        code: input.code,
        message: input.message,
        details,
      },
      meta,
    ) as ApiErrorResponse<
      TCode | ErrorCode,
      TDetails,
      TMeta | (Record<string, unknown> | undefined)
    >;
  }

  return buildErrorResponse(input, meta);
}

export interface PaginationMeta {
  totalItems: number;
  totalPages: number;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

type AdditionalMeta<TAdditional extends Record<string, unknown> | undefined> =
  TAdditional extends Record<string, unknown> ? TAdditional : Record<string, never>;

export type PaginatedResponseMeta<
  TAdditional extends Record<string, unknown> | undefined = undefined,
> = { pagination: PaginationMeta } & AdditionalMeta<TAdditional>;

export interface PaginatedResponseOptions<
  TAdditional extends Record<string, unknown> | undefined = undefined,
> {
  totalItems: number;
  page: number;
  pageSize: number;
  totalPages?: number;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
  meta?: TAdditional;
}

const assertInteger = (value: number, field: string) => {
  if (!Number.isInteger(value)) {
    throw new TypeError(`${field} must be an integer.`);
  }
};

export const paginatedResponse = <
  TItem,
  TAdditional extends Record<string, unknown> | undefined = undefined,
>(
  items: readonly TItem[],
  options: PaginatedResponseOptions<TAdditional>,
): ApiSuccessResponse<readonly TItem[], PaginatedResponseMeta<TAdditional>> => {
  const { totalItems, page, pageSize } = options;

  assertInteger(totalItems, "totalItems");
  assertInteger(page, "page");
  assertInteger(pageSize, "pageSize");

  if (totalItems < 0) {
    throw new RangeError("totalItems cannot be negative.");
  }

  if (pageSize <= 0) {
    throw new RangeError("pageSize must be greater than zero.");
  }

  if (page < 1) {
    throw new RangeError("page must be at least 1.");
  }

  const minimumTotalPages = totalItems === 0 ? 0 : Math.max(1, Math.ceil(totalItems / pageSize));
  const totalPages = options.totalPages ?? minimumTotalPages;

  assertInteger(totalPages, "totalPages");

  if (totalPages < 0) {
    throw new RangeError("totalPages cannot be negative.");
  }

  if (options.totalPages !== undefined && totalPages < minimumTotalPages) {
    throw new RangeError(
      "totalPages cannot be less than the minimum derived from totalItems/pageSize.",
    );
  }

  if (totalPages > 0 && page > totalPages) {
    throw new RangeError("page cannot be greater than totalPages.");
  }

  const hasNextPage = options.hasNextPage ?? (totalPages === 0 ? false : page < totalPages);
  const hasPreviousPage = options.hasPreviousPage ?? page > 1;

  const pagination: PaginationMeta = {
    totalItems,
    totalPages,
    page,
    pageSize,
    hasNextPage,
    hasPreviousPage,
  };

  const additionalMeta = options.meta;
  const meta = (
    additionalMeta ? { pagination, ...additionalMeta } : { pagination }
  ) as PaginatedResponseMeta<TAdditional>;

  return successResponse(items, meta);
};
