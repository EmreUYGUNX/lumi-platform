export type MediaResourceType = "image" | "video" | "raw";

export type MediaSortField = "date" | "size" | "name";
export type MediaSortDirection = "asc" | "desc";
export type MediaViewMode = "grid" | "list";

export interface MediaUsageSummary {
  products: { id: string; title: string; slug: string }[];
  variants: { id: string; sku: string; productId: string }[];
}

export interface MediaAsset {
  id: string;
  publicId: string;
  url: string;
  secureUrl: string;
  folder?: string;
  format: string;
  resourceType: MediaResourceType;
  type: string;
  width?: number;
  height?: number;
  bytes: number;
  tags: string[];
  metadata?: Record<string, unknown> | null;
  version: number;
  transformations: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  usage: MediaUsageSummary;
  isOptimistic?: boolean;
  placeholderId?: string;
}

export interface PaginatedResponse<TItem> {
  items: TItem[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface MediaListFilters {
  folder?: string;
  tags?: string[];
  search?: string;
  includeDeleted?: boolean;
  resourceType?: MediaResourceType;
  sortBy: MediaSortField;
  sortDirection: MediaSortDirection;
}

export interface MediaListRequest extends Partial<MediaListFilters> {
  page?: number;
  perPage?: number;
}

export interface MediaUploadPayload {
  folder: string;
  tags?: string[];
  visibility?: "public" | "private" | "internal";
  metadata?: Record<string, unknown>;
}

export interface MediaUploadResponse {
  success: boolean;
  data: {
    uploads: MediaAsset[];
    failures: {
      fileName: string;
      message: string;
      code: string;
      status?: number;
    }[];
  };
}

export interface UploadQueueItem {
  id: string;
  file: File;
  previewUrl: string;
  status: "pending" | "queued" | "uploading" | "success" | "error" | "canceled";
  progress: number;
  error?: string;
  attempt: number;
  asset?: MediaAsset;
  placeholderAsset?: MediaAsset;
}

export interface MediaFolderOption {
  label: string;
  value: string;
  maxSizeMb?: number;
}

export interface MediaDeletePayload {
  id: string;
}

export interface MediaUpdatePayload {
  id: string;
  folder?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export const MEDIA_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const DEFAULT_MAX_SIZE_MB = 5;
