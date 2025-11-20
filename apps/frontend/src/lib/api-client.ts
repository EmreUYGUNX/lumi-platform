import { z } from "zod";

import { env } from "@/lib/env";
import { sessionStore } from "@/store";

const API_BASE_URL = env.NEXT_PUBLIC_API_URL.replace(/\/+$/u, "");

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface Q2SuccessResponse<TData, TMeta = Record<string, unknown> | undefined> {
  success: true;
  data: TData;
  meta?: TMeta;
}

export interface Q2ErrorResponse<TMeta = Record<string, unknown> | undefined> {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: TMeta;
}

const baseErrorSchema = z
  .object({
    success: z.literal(false),
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.unknown().optional(),
    }),
    meta: z.record(z.unknown()).optional(),
  })
  .strict();

const buildSuccessSchema = <TData extends z.ZodTypeAny, TMeta extends z.ZodTypeAny | undefined>(
  dataSchema: TData,
  metaSchema?: TMeta,
) =>
  z
    .object({
      success: z.literal(true),
      data: dataSchema,
      meta: metaSchema ? metaSchema.optional() : z.record(z.unknown()).optional(),
    })
    .strict();

export const isSuccessResponse = <TData = unknown>(
  payload: unknown,
): payload is Q2SuccessResponse<TData> => {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      "success" in payload &&
      (payload as Record<string, unknown>).success === true,
  );
};

export const isErrorResponse = (payload: unknown): payload is Q2ErrorResponse => {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      "success" in payload &&
      (payload as Record<string, unknown>).success === false &&
      "error" in payload,
  );
};

export class ApiClientError<TDetails = unknown> extends Error {
  readonly code: string;

  readonly details?: TDetails;

  readonly status?: number;

  constructor(params: { code: string; message: string; details?: TDetails; status?: number }) {
    super(params.message);
    this.code = params.code;
    this.details = params.details;
    this.status = params.status;
  }
}

const toQueryString = (
  query: Record<string, string | number | boolean | (string | number | boolean)[] | undefined>,
): string => {
  const searchParams = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => searchParams.append(key, String(entry)));
      return;
    }

    searchParams.append(key, String(value));
  });

  const result = searchParams.toString();
  return result ? `?${result}` : "";
};

export interface ApiRequestOptions<
  TDataSchema extends z.ZodTypeAny,
  TMetaSchema extends z.ZodTypeAny | undefined = undefined,
> {
  path: string;
  method?: HttpMethod;
  query?: Record<string, string | number | boolean | (string | number | boolean)[] | undefined>;
  body?: unknown;
  dataSchema: TDataSchema;
  metaSchema?: TMetaSchema;
  headers?: Record<string, string>;
  authToken?: string;
  signal?: AbortSignal;
  retry?: number;
  credentials?: RequestCredentials;
}

const logRequest = (message: string, context: Record<string, unknown>) => {
  if (process.env.NODE_ENV !== "development") {
    return;
  }
  console.info(`[api-client] ${message}`, context);
};

export interface ApiRequestResult<
  TDataSchema extends z.ZodTypeAny,
  TMetaSchema extends z.ZodTypeAny | undefined,
> {
  data: z.infer<TDataSchema>;
  meta: TMetaSchema extends z.ZodTypeAny ? z.infer<TMetaSchema> | undefined : undefined;
}

const buildRequestUrl = (
  path: string,
  query?: Record<string, string | number | boolean | (string | number | boolean)[] | undefined>,
) => {
  const normalisedPath = path.startsWith("/") ? path : `/${path}`;
  const queryString = query ? toQueryString(query) : "";
  return `${API_BASE_URL}${normalisedPath}${queryString}`;
};

const serializeBody = (body: unknown): BodyInit | undefined => {
  if (!body || typeof body !== "object" || body instanceof FormData) {
    return body as BodyInit | undefined;
  }

  return JSON.stringify(body);
};

const createHeaders = (
  serializedBody: BodyInit | undefined,
  providedHeaders: Record<string, string> | undefined,
  authToken: string | undefined,
): Record<string, string> => {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...providedHeaders,
  };

  if (serializedBody && !(serializedBody instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  return headers;
};

const parseSuccessPayload = <
  TDataSchema extends z.ZodTypeAny,
  TMetaSchema extends z.ZodTypeAny | undefined,
>(
  payload: unknown,
  dataSchema: TDataSchema,
  metaSchema?: TMetaSchema,
): ApiRequestResult<TDataSchema, TMetaSchema> => {
  const schema = buildSuccessSchema(dataSchema, metaSchema);
  const parsed = schema.safeParse(payload);

  if (!parsed.success) {
    throw new ApiClientError({
      code: "INVALID_RESPONSE",
      message: "Yanıt Q2 formatını karşılamıyor.",
      details: parsed.error.flatten(),
    });
  }

  return {
    data: parsed.data.data,
    meta: metaSchema
      ? (parsed.data.meta as ApiRequestResult<TDataSchema, TMetaSchema>["meta"])
      : (undefined as ApiRequestResult<TDataSchema, TMetaSchema>["meta"]),
  };
};

const parseErrorPayload = (payload: unknown, status: number): ApiClientError => {
  const parsedError = baseErrorSchema.safeParse(payload);

  if (parsedError.success) {
    return new ApiClientError({
      code: parsedError.data.error.code,
      message: parsedError.data.error.message,
      details: parsedError.data.error.details,
      status,
    });
  }

  return new ApiClientError({
    code: "UNKNOWN_ERROR",
    message: "Beklenmeyen bir hata oluştu.",
    details: payload,
    status,
  });
};

const isRetriable = (attemptIndex: number, maxAttempts: number, error: unknown): boolean => {
  if (attemptIndex >= maxAttempts - 1) {
    return false;
  }

  if (error instanceof TypeError) {
    return true;
  }

  if (error instanceof ApiClientError) {
    return typeof error.status === "number" && error.status >= 500;
  }

  return false;
};

const waitFor = (delayMs: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });

const nextDelay = (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 5000);

export async function apiRequest<
  TDataSchema extends z.ZodTypeAny,
  TMetaSchema extends z.ZodTypeAny | undefined = undefined,
>(
  options: ApiRequestOptions<TDataSchema, TMetaSchema>,
): Promise<ApiRequestResult<TDataSchema, TMetaSchema>> {
  const {
    path,
    method = "GET",
    query,
    body,
    dataSchema,
    metaSchema,
    headers,
    authToken,
    signal,
    retry,
    credentials = "include",
  } = options;

  const requestUrl = buildRequestUrl(path, query);
  const serializedBody = serializeBody(body);
  const token = authToken ?? sessionStore.getState().accessToken;
  const resolvedHeaders = createHeaders(serializedBody, headers, token);
  const attempts = Math.max(0, retry ?? (method === "GET" ? 2 : 0)) + 1;

  const execute = async (
    attemptIndex: number,
  ): Promise<ApiRequestResult<TDataSchema, TMetaSchema>> => {
    try {
      const requestStart = Date.now();
      const response = await fetch(requestUrl, {
        method,
        headers: resolvedHeaders,
        body: serializedBody,
        credentials,
        signal,
      });
      const duration = Date.now() - requestStart;
      logRequest(`${method} ${path}`, { status: response.status, duration });

      const payload = await response.json().catch(() => {
        throw new ApiClientError({
          code: "INVALID_JSON",
          message: "Beklenmeyen yanıt formatı alındı.",
          status: response.status,
        });
      });

      if (response.ok) {
        return parseSuccessPayload(payload, dataSchema, metaSchema);
      }

      throw parseErrorPayload(payload, response.status);
    } catch (error) {
      if (!isRetriable(attemptIndex, attempts, error)) {
        if (error instanceof Error) {
          throw error;
        }
        throw new ApiClientError({
          code: "UNKNOWN_ERROR",
          message: "İstek başarısız oldu.",
          details: error,
        });
      }

      await waitFor(nextDelay(attemptIndex + 1));
      return execute(attemptIndex + 1);
    }
  };

  return execute(0);
}

export const apiClient = {
  get: <TData extends z.ZodTypeAny, TMeta extends z.ZodTypeAny | undefined = undefined>(
    path: string,
    options: Omit<ApiRequestOptions<TData, TMeta>, "path" | "method">,
  ) => apiRequest<TData, TMeta>({ ...options, path, method: "GET" }),
  post: <TData extends z.ZodTypeAny, TMeta extends z.ZodTypeAny | undefined = undefined>(
    path: string,
    options: Omit<ApiRequestOptions<TData, TMeta>, "path" | "method">,
  ) => apiRequest<TData, TMeta>({ ...options, path, method: "POST" }),
  patch: <TData extends z.ZodTypeAny, TMeta extends z.ZodTypeAny | undefined = undefined>(
    path: string,
    options: Omit<ApiRequestOptions<TData, TMeta>, "path" | "method">,
  ) => apiRequest<TData, TMeta>({ ...options, path, method: "PATCH" }),
  put: <TData extends z.ZodTypeAny, TMeta extends z.ZodTypeAny | undefined = undefined>(
    path: string,
    options: Omit<ApiRequestOptions<TData, TMeta>, "path" | "method">,
  ) => apiRequest<TData, TMeta>({ ...options, path, method: "PUT" }),
  delete: <TData extends z.ZodTypeAny, TMeta extends z.ZodTypeAny | undefined = undefined>(
    path: string,
    options: Omit<ApiRequestOptions<TData, TMeta>, "path" | "method">,
  ) => apiRequest<TData, TMeta>({ ...options, path, method: "DELETE" }),
};
