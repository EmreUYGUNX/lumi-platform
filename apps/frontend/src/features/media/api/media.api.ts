import type {
  MediaAsset,
  MediaDeletePayload,
  MediaListRequest,
  MediaUpdatePayload,
} from "../types/media.types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1";
const MEDIA_ENDPOINT = `${API_BASE_URL}/media`;
const ADMIN_MEDIA_ENDPOINT = `${API_BASE_URL}/admin/media`;

interface ApiSuccessResponse<TData = unknown, TMeta = unknown> {
  success: boolean;
  data: TData;
  meta?: TMeta;
}

interface PaginationEnvelope<T> {
  pagination: {
    totalItems: number;
    totalPages: number;
    page: number;
    pageSize: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  extra?: T;
}

const buildHeaders = (token?: string, extra?: HeadersInit): Record<string, string> => {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (extra && typeof extra === "object") {
    Object.assign(headers, extra);
  }

  if (!headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};

const toQueryString = (
  params: Record<string, string | number | boolean | undefined | string[]>,
): string => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => query.append(key, entry));
      return;
    }

    query.append(key, String(value));
  });
  const result = query.toString();
  return result ? `?${result}` : "";
};

export interface ListMediaResponse {
  items: MediaAsset[];
  meta: PaginationEnvelope<unknown>["pagination"];
}

export const listMediaRequest = async (
  params: MediaListRequest,
  token?: string,
): Promise<ListMediaResponse> => {
  const query = toQueryString({
    page: params.page,
    perPage: params.perPage,
    folder: params.folder,
    resourceType: params.resourceType,
    search: params.search,
    includeDeleted: params.includeDeleted,
    tags: params.tags,
  });

  const response = await fetch(`${MEDIA_ENDPOINT}${query}`, {
    credentials: "include",
    headers: buildHeaders(token),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch media assets (${response.status})`);
  }

  const payload = (await response.json()) as ApiSuccessResponse<
    MediaAsset[],
    { pagination: PaginationEnvelope<unknown>["pagination"] }
  >;
  const pagination = payload.meta?.pagination ?? {
    totalItems: payload.data.length,
    page: params.page ?? 1,
    pageSize: params.perPage ?? payload.data.length,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  };

  return {
    items: payload.data,
    meta: pagination,
  };
};

export const deleteMediaRequest = async (
  payload: MediaDeletePayload,
  token?: string,
): Promise<void> => {
  const response = await fetch(`${ADMIN_MEDIA_ENDPOINT}/${payload.id}`, {
    method: "DELETE",
    headers: buildHeaders(token),
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Failed to delete media asset (${response.status})`);
  }
};

export const updateMediaRequest = async (
  payload: MediaUpdatePayload,
  token?: string,
): Promise<MediaAsset> => {
  const response = await fetch(`${ADMIN_MEDIA_ENDPOINT}/${payload.id}`, {
    method: "PUT",
    headers: buildHeaders(token),
    body: JSON.stringify({
      folder: payload.folder,
      tags: payload.tags,
      metadata: payload.metadata,
    }),
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Failed to update media asset (${response.status})`);
  }

  const payloadJson = (await response.json()) as ApiSuccessResponse<MediaAsset>;
  return payloadJson.data;
};
