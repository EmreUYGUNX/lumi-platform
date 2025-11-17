import { performance } from "node:perf_hooks";

import type { MediaAsset, Prisma, Product, ProductVariant } from "@prisma/client";
import { MediaVisibility as PrismaMediaVisibility } from "@prisma/client";
import type { UploadApiOptions, UploadApiResponse } from "cloudinary";

import { getConfig } from "@/config/index.js";
import { ApiError } from "@/errors/api-error.js";
import {
  type CloudinaryClient,
  getCloudinaryClient,
} from "@/integrations/cloudinary/cloudinary.client.js";
import { createChildLogger } from "@/lib/logger.js";
import { getPrismaClient } from "@/lib/prisma.js";
import type { PaginatedResult } from "@/lib/repository/base.repository.js";
import { mediaMetrics } from "@/observability/media-metrics.js";
import type { ApplicationConfig } from "@lumi/types";

import { reportMediaCloudinaryError, reportMediaUploadFailure } from "./media.alerts.js";
import type { MediaAccessFilter, MediaListFilters } from "./media.repository.js";
import { MediaRepository } from "./media.repository.js";
import { MediaScanService, sanitizeFilename } from "./media.security.js";
import { MediaThreatService } from "./media.threats.js";
import { MediaUsageMonitor } from "./media.usage-monitor.js";
import {
  IMAGE_MIME_WHITELIST,
  type MediaListQuery,
  type MediaSignatureBody,
  type MediaUpdateBody,
  type MediaUploadBody,
} from "./media.validators.js";

const MAX_PRODUCT_BYTES = 5 * 1024 * 1024;
const MAX_BANNER_BYTES = 10 * 1024 * 1024;
const MAX_CONCURRENT_UPLOADS = 5;
const PRIVILEGED_ROLES = new Set(["admin", "staff"]);
const AUDIT_ENTITY = "media.assets";

const NAMED_VARIANTS = [
  { name: "thumbnail", transformation: { width: 300, height: 300, crop: "fill" } },
  { name: "medium", transformation: { width: 800, height: 800, crop: "limit" } },
  { name: "large", transformation: { width: 1920, crop: "limit" } },
] as const;

const BLUR_PLACEHOLDER_TRANSFORMATION = {
  width: 20,
  crop: "fill",
  effect: "blur:1000",
  quality: "auto:low",
} as const;

type VisibilityInput = MediaUploadBody["visibility"];

const VISIBILITY_TO_PRISMA: Record<VisibilityInput, PrismaMediaVisibility> = {
  public: PrismaMediaVisibility.PUBLIC,
  private: PrismaMediaVisibility.PRIVATE,
  internal: PrismaMediaVisibility.INTERNAL,
} as const;

const PRISMA_TO_VISIBILITY = new Map<PrismaMediaVisibility, VisibilityInput>([
  [PrismaMediaVisibility.PUBLIC, "public"],
  [PrismaMediaVisibility.PRIVATE, "private"],
  [PrismaMediaVisibility.INTERNAL, "internal"],
]);

const resolvePrismaVisibility = (value: VisibilityInput): PrismaMediaVisibility =>
  // eslint-disable-next-line security/detect-object-injection -- visibility map is a sealed constant.
  VISIBILITY_TO_PRISMA[value] ?? PrismaMediaVisibility.PUBLIC;

const resolveOutputVisibility = (value?: PrismaMediaVisibility | null): VisibilityInput =>
  PRISMA_TO_VISIBILITY.get(value ?? PrismaMediaVisibility.PUBLIC) ?? "public";

const CACHE_STATUS_HEADER_KEYS = ["x-cache", "cf-cache-status", "x-cld-cache"] as const;
const CACHE_PREFETCH_CONCURRENCY = 4;

const detectCacheStatus = (headers: Headers): "hit" | "miss" | "unknown" => {
  // eslint-disable-next-line no-restricted-syntax -- Finite iteration over a fixed header allowlist.
  for (const headerKey of CACHE_STATUS_HEADER_KEYS) {
    // eslint-disable-next-line security/detect-object-injection -- header names come from a fixed allowlist.
    const value = headers.get(headerKey);
    if (value) {
      const normalised = value.toLowerCase();
      if (normalised.includes("hit")) {
        return "hit";
      }
      if (normalised.includes("miss")) {
        return "miss";
      }
    }
  }

  const ageHeader = headers.get("age");
  if (ageHeader && Number.parseInt(ageHeader, 10) > 0) {
    return "hit";
  }

  return "unknown";
};

type MediaAssetWithUsage = MediaAsset & {
  products?: Pick<Product, "id" | "title" | "slug">[];
  productVariants?: Pick<ProductVariant, "id" | "sku" | "productId">[];
};

const MEDIA_USAGE_INCLUDE = {
  products: {
    select: {
      id: true,
      title: true,
      slug: true,
    },
  },
  productVariants: {
    select: {
      id: true,
      sku: true,
      productId: true,
    },
  },
} as const;

export interface PreparedUploadFile {
  fieldName: string;
  originalName: string;
  mimeType: string;
  size: number;
  buffer: Buffer;
}

export interface UploadContext extends MediaUploadBody {
  uploadedById: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface UploadedMedia {
  id: string;
  publicId: string;
  folder?: string | null;
  format: string;
  width?: number | null;
  height?: number | null;
  bytes: number;
  url: string;
  secureUrl: string;
  transformations: Record<string, string>;
  metadata?: Record<string, unknown>;
  resourceType: string;
  type: string;
  tags: string[];
  version: number;
  visibility: MediaUploadBody["visibility"];
}

export interface FailedUpload {
  fileName: string;
  message: string;
  code: string;
  status?: number;
}

export interface MediaUploadResult {
  uploads: UploadedMedia[];
  failures: FailedUpload[];
}

export interface MediaUsageSummary {
  products: { id: string; title: string; slug: string }[];
  variants: { id: string; sku: string; productId: string }[];
}

export interface MediaAssetView extends UploadedMedia {
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  usage: MediaUsageSummary;
}

export interface MediaListResult {
  items: MediaAssetView[];
  meta: PaginatedResult<MediaAsset>["meta"];
}

export interface MediaActionContext {
  userId: string;
  roles: readonly string[];
}

export interface MediaServiceOptions {
  repository?: MediaRepository;
  cloudinaryClient?: CloudinaryClient;
  logger?: ReturnType<typeof createChildLogger>;
  scanService?: MediaScanService;
  threatService?: MediaThreatService;
  config?: ApplicationConfig;
}

const assertFilesProvided = (files: PreparedUploadFile[]): void => {
  if (files.length === 0) {
    throw new ApiError("At least one file is required.", {
      status: 400,
      code: "NO_FILES",
    });
  }
};

const ensureSuccessfulUpload = (result: MediaUploadResult): void => {
  if (result.uploads.length > 0 || result.failures.length === 0) {
    return;
  }

  const firstFailure = result.failures[0];
  if (!firstFailure) {
    return;
  }

  throw new ApiError(firstFailure.message, {
    status: firstFailure.status ?? 400,
    code: firstFailure.code,
    details: [
      {
        message: firstFailure.message,
        fileName: firstFailure.fileName,
      },
    ],
  });
};

const chunk = <T>(items: readonly T[], size: number): T[][] => {
  if (items.length === 0) {
    return [];
  }

  const buckets: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    buckets.push(items.slice(index, index + size));
  }
  return buckets;
};

const normaliseTags = (tags: readonly string[]): string[] => [...new Set(tags)];

const resolveMimeExtension = (mimeType: string): string | undefined =>
  IMAGE_MIME_WHITELIST.get(mimeType)?.extension;

const resolveResourceType = (value?: string): UploadApiOptions["resource_type"] =>
  (value as UploadApiOptions["resource_type"]) ?? "image";

const resolveAssetType = (value?: string): UploadApiOptions["type"] =>
  (value as UploadApiOptions["type"]) ?? "upload";

const isPrivilegedActor = (actor: MediaActionContext): boolean =>
  actor.roles.some((role) => PRIVILEGED_ROLES.has(role.toLowerCase()));

const assertPrivilegedActor = (actor: MediaActionContext): void => {
  if (isPrivilegedActor(actor)) {
    return;
  }

  throw new ApiError("You do not have permission to manage media assets.", {
    status: 403,
    code: "FORBIDDEN",
  });
};

const assertOwnerOrPrivileged = (asset: MediaAsset, actor: MediaActionContext): void => {
  if (asset.uploadedById === actor.userId) {
    return;
  }

  assertPrivilegedActor(actor);
};

const assertAssetNotInUse = (asset: MediaAssetWithUsage): void => {
  const productUsage = asset.products?.length ?? 0;
  const variantUsage = asset.productVariants?.length ?? 0;
  if (productUsage === 0 && variantUsage === 0) {
    return;
  }

  throw new ApiError("Media asset is currently assigned to products or variants.", {
    status: 409,
    code: "CONFLICT",
    details: [
      {
        message: "Detach all associations before deleting this asset.",
        products: productUsage,
        variants: variantUsage,
      },
    ],
  });
};

const assertVisibilityAccess = (asset: MediaAssetWithUsage, actor?: MediaActionContext): void => {
  if (!actor) {
    if (asset.visibility !== PrismaMediaVisibility.PUBLIC) {
      throw new ApiError("You do not have permission to view this media asset.", {
        status: 403,
        code: "FORBIDDEN",
      });
    }
    return;
  }

  if (isPrivilegedActor(actor) || asset.uploadedById === actor.userId) {
    return;
  }

  if (
    asset.visibility === PrismaMediaVisibility.INTERNAL ||
    asset.visibility === PrismaMediaVisibility.PUBLIC
  ) {
    return;
  }

  throw new ApiError("You do not have permission to view this media asset.", {
    status: 403,
    code: "FORBIDDEN",
  });
};

const buildAccessFilter = (actor?: MediaActionContext): MediaAccessFilter | undefined => {
  if (!actor) {
    return {
      visibilities: [PrismaMediaVisibility.PUBLIC],
    } satisfies MediaAccessFilter;
  }

  if (isPrivilegedActor(actor)) {
    return undefined;
  }

  return {
    ownerId: actor.userId,
    visibilities: [PrismaMediaVisibility.PUBLIC, PrismaMediaVisibility.INTERNAL],
  } satisfies MediaAccessFilter;
};

/* eslint-disable security/detect-object-injection */
const buildTransformationMap = (
  uploadResult: UploadApiResponse,
  client: CloudinaryClient,
  config: ApplicationConfig,
): Record<string, string> => {
  const entries: [string, string][] = [];

  const primaryUrl = uploadResult.secure_url ?? uploadResult.url;
  if (primaryUrl) {
    entries.push(["original", primaryUrl]);
  }

  const eagerEntries = Array.isArray(uploadResult.eager) ? uploadResult.eager : [];

  eagerEntries.slice(0, NAMED_VARIANTS.length).forEach((entry, index) => {
    const variantName = NAMED_VARIANTS[index]?.name ?? `variant_${index}`;
    const url = entry.secure_url ?? entry.url;
    if (url) {
      // eslint-disable-next-line security/detect-object-injection -- Variant keys are derived from a fixed allowlist.
      entries.push([variantName, url]);
    }
  });

  if (uploadResult.public_id) {
    config.media.cloudinary.responsiveBreakpoints.forEach((width) => {
      const url = client.generateImageUrl(uploadResult.public_id, {
        transformation: {
          width,
          crop: "limit",
        },
        version: uploadResult.version,
        resourceType: resolveResourceType(uploadResult.resource_type ?? undefined),
        type: resolveAssetType(uploadResult.type ?? undefined),
      });

      // eslint-disable-next-line security/detect-object-injection -- Responsive keys map to controlled breakpoint widths.
      entries.push([`responsive_${width}`, url]);
    });
  }

  return Object.fromEntries(entries);
};
/* eslint-enable security/detect-object-injection */

const buildTransformationMapFromAsset = (
  asset: MediaAsset,
  client: CloudinaryClient,
  config: ApplicationConfig,
): Record<string, string> => {
  const entries: [string, string][] = [];
  const primaryUrl = asset.secureUrl || asset.url;
  if (primaryUrl) {
    entries.push(["original", primaryUrl]);
  }

  NAMED_VARIANTS.forEach(({ name, transformation }) => {
    const url = client.generateImageUrl(asset.publicId, {
      transformation,
      version: asset.version,
      resourceType: resolveResourceType(asset.resourceType),
      type: resolveAssetType(asset.type),
    });
    entries.push([name, url]);
  });

  config.media.cloudinary.responsiveBreakpoints.forEach((width) => {
    const url = client.generateImageUrl(asset.publicId, {
      transformation: {
        width,
        crop: "limit",
      },
      version: asset.version,
      resourceType: resolveResourceType(asset.resourceType),
      type: resolveAssetType(asset.type),
    });
    entries.push([`responsive_${width}`, url]);
  });

  return Object.fromEntries(entries);
};

const extractDominantColor = (uploadResult: UploadApiResponse): string | undefined => {
  if (!Array.isArray(uploadResult.colors) || uploadResult.colors.length === 0) {
    return undefined;
  }

  const [first] = uploadResult.colors;

  if (Array.isArray(first) && typeof first[0] === "string") {
    return first[0];
  }

  if (typeof first === "string") {
    return first;
  }

  return undefined;
};

const calculateAspectRatio = (width?: number, height?: number): number | undefined => {
  if (!width || !height || height === 0) {
    return undefined;
  }

  return Number((width / height).toFixed(3));
};

const normaliseRecordMetadata = (
  metadata?: Prisma.JsonValue | null,
): Record<string, unknown> | undefined => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return undefined;
  }

  return metadata as Record<string, unknown>;
};

const mapUsage = (record: MediaAssetWithUsage): MediaUsageSummary => ({
  products: Array.isArray(record.products)
    ? record.products.map((product) => ({
        id: product.id,
        title: product.title,
        slug: product.slug,
      }))
    : [],
  variants: Array.isArray(record.productVariants)
    ? record.productVariants.map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        productId: variant.productId,
      }))
    : [],
});

const normaliseMetadataValues = (
  metadata?: Record<string, unknown>,
): Record<string, string> | undefined => {
  if (!metadata) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => {
      if (value === null || value === undefined) {
        return [key, ""];
      }

      if (typeof value === "string") {
        return [key, value];
      }

      return [key, String(value)];
    }),
  );
};

const buildPersistenceMetadata = (
  uploadResult: UploadApiResponse,
  context: UploadContext,
  file: PreparedUploadFile,
  blurDataUrl?: string,
): Prisma.InputJsonValue => {
  const metadata = {
    ...context.metadata,
    dominantColor: extractDominantColor(uploadResult),
    aspectRatio: calculateAspectRatio(
      uploadResult.width ?? undefined,
      uploadResult.height ?? undefined,
    ),
    visibility: context.visibility,
    originalFilename: file.originalName,
    blurDataUrl,
  };

  return Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined && value !== ""),
  );
};

const ensureMimeTypeSupported = (extension: string | undefined, mimeType: string): string => {
  if (extension) {
    return extension;
  }

  throw new ApiError("Unsupported media type.", {
    status: 415,
    details: [
      {
        message: `MIME type ${mimeType} is not supported.`,
      },
    ],
  });
};

const enforceFileSizeLimit = (file: PreparedUploadFile, sizeLimit: number): void => {
  if (file.size <= sizeLimit) {
    return;
  }

  throw new ApiError("File exceeds maximum allowed size.", {
    status: 413,
    details: [
      {
        message: `Maximum allowed size is ${sizeLimit} bytes`,
        maxBytes: sizeLimit,
      },
    ],
  });
};

export class MediaService {
  private readonly repository: MediaRepository;

  private readonly cloudinary: CloudinaryClient;

  private readonly logger: ReturnType<typeof createChildLogger>;

  private readonly scanner: MediaScanService;

  private readonly threats: MediaThreatService;

  private readonly config: ApplicationConfig;

  private readonly auditEntityToken = AUDIT_ENTITY;

  private readonly usageMonitor?: MediaUsageMonitor;

  constructor(options: MediaServiceOptions = {}) {
    this.repository = options.repository ?? new MediaRepository(getPrismaClient());
    this.cloudinary = options.cloudinaryClient ?? getCloudinaryClient();
    this.logger = options.logger ?? createChildLogger("media:service");
    this.scanner = options.scanService ?? new MediaScanService();
    this.threats = options.threatService ?? new MediaThreatService();
    this.config = options.config ?? getConfig();
    this.usageMonitor = new MediaUsageMonitor({
      client: this.cloudinary,
      logger: this.logger,
    });
  }

  getAuditEntity(): string {
    return this.auditEntityToken;
  }

  startUsageMonitoring(): void {
    this.usageMonitor?.start();
  }

  async listAssets(query?: MediaListQuery, actor?: MediaActionContext): Promise<MediaListResult> {
    const resolvedQuery = query ?? {};
    const privileged = actor ? isPrivilegedActor(actor) : false;
    const filters: MediaListFilters = {
      uploadedById: resolvedQuery.uploadedById,
      folder: resolvedQuery.folder,
      productId: resolvedQuery.productId,
      productVariantId: resolvedQuery.productVariantId,
      tags: resolvedQuery.tags,
      tag: resolvedQuery.tag,
      resourceType: resolvedQuery.resourceType,
      search: resolvedQuery.search,
      includeDeleted: privileged ? resolvedQuery.includeDeleted : undefined,
    };

    const accessFilter = buildAccessFilter(actor);
    if (accessFilter) {
      filters.access = accessFilter;
    }

    const result = await this.repository.list(filters, {
      page: resolvedQuery.page,
      pageSize: resolvedQuery.perPage,
    });

    return {
      items: result.items.map((record) => {
        const typed = record as MediaAssetWithUsage;
        assertVisibilityAccess(typed, actor);
        return this.toAssetView(typed);
      }),
      meta: result.meta,
    };
  }

  async getAsset(id: string, actor?: MediaActionContext): Promise<MediaAssetView> {
    const asset = await this.loadAsset(id, { includeUsage: true });
    assertVisibilityAccess(asset, actor);
    return this.toAssetView(asset);
  }

  async updateAsset(
    id: string,
    payload: MediaUpdateBody,
    actor: MediaActionContext,
  ): Promise<MediaAssetView> {
    const asset = await this.loadAsset(id, { includeUsage: true });
    assertOwnerOrPrivileged(asset, actor);

    const data: Prisma.MediaAssetUpdateInput = {};
    if (payload.folder) {
      data.folder = payload.folder;
    }
    if (payload.tags) {
      data.tags = payload.tags;
    }
    if (payload.metadata !== undefined) {
      data.metadata = payload.metadata;
    }
    if (payload.visibility) {
      data.visibility = resolvePrismaVisibility(payload.visibility);
    }

    if (Object.keys(data).length > 0) {
      await this.repository.updateMetadata(id, data);
    }

    const refreshed = await this.loadAsset(id, { includeUsage: true });
    return this.toAssetView(refreshed);
  }

  async regenerateAsset(id: string, actor: MediaActionContext): Promise<MediaAssetView> {
    const asset = await this.loadAsset(id, { includeUsage: true });
    assertPrivilegedActor(actor);

    let response: UploadApiResponse;
    try {
      response = await this.cloudinary.regenerateAsset(asset.publicId, {
        resourceType: resolveResourceType(asset.resourceType),
        type: resolveAssetType(asset.type),
        invalidate: true,
      });
    } catch (error) {
      mediaMetrics.recordCloudinaryError("regenerate");
      reportMediaCloudinaryError({
        operation: "regenerate",
        publicId: asset.publicId,
        folder: asset.folder,
        errorMessage: error instanceof Error ? error.message : undefined,
      });
      throw error;
    }

    await this.repository.updateMetadata(id, {
      version: response.version ?? asset.version,
      width: response.width ?? asset.width ?? undefined,
      height: response.height ?? asset.height ?? undefined,
      bytes: response.bytes ?? asset.bytes,
      url: response.url ?? asset.url,
      secureUrl: response.secure_url ?? asset.secureUrl,
      format: response.format ?? asset.format,
    });

    const refreshed = await this.loadAsset(id, { includeUsage: true });
    return this.toAssetView(refreshed, response);
  }

  async softDeleteAsset(id: string, actor: MediaActionContext): Promise<MediaAssetView> {
    const asset = await this.loadAsset(id, { includeUsage: true });
    assertPrivilegedActor(actor);
    assertAssetNotInUse(asset);

    await this.repository.softDeleteAsset(id);
    const deleted = await this.loadAsset(id, { includeUsage: true, includeDeleted: true });
    return this.toAssetView(deleted);
  }

  async hardDeleteAsset(id: string, actor: MediaActionContext): Promise<MediaAssetView> {
    const asset = await this.loadAsset(id, { includeUsage: true, includeDeleted: true });
    assertPrivilegedActor(actor);

    if (!asset.deletedAt) {
      throw new ApiError("Media asset must be soft deleted before permanent removal.", {
        status: 409,
        code: "CONFLICT",
      });
    }

    assertAssetNotInUse(asset);

    try {
      await this.cloudinary.deleteAsset(asset.publicId, {
        resourceType: resolveResourceType(asset.resourceType),
        invalidate: true,
      });
    } catch (error) {
      mediaMetrics.recordCloudinaryError("delete");
      reportMediaCloudinaryError({
        operation: "delete",
        publicId: asset.publicId,
        folder: asset.folder,
        errorMessage: error instanceof Error ? error.message : undefined,
      });
      throw error;
    }

    await this.repository.forceDeleteAsset(id);
    return this.toAssetView(asset);
  }

  async upload(files: PreparedUploadFile[], context: UploadContext): Promise<MediaUploadResult> {
    assertFilesProvided(files);

    const batches = chunk(files, MAX_CONCURRENT_UPLOADS);
    const result = await this.processUploadBatches(batches, context);

    ensureSuccessfulUpload(result);
    return result;
  }

  private async processUploadBatches(
    batches: PreparedUploadFile[][],
    context: UploadContext,
  ): Promise<MediaUploadResult> {
    const uploads: UploadedMedia[] = [];
    const failures: FailedUpload[] = [];

    // eslint-disable-next-line no-restricted-syntax
    for (const batch of batches) {
      // eslint-disable-next-line no-await-in-loop
      const settled = await Promise.allSettled(
        batch.map(async (file) => this.processSingleUpload(file, context)),
      );

      settled.forEach((result, index) => {
        if (result.status === "fulfilled") {
          uploads.push(result.value);
          return;
        }

        // eslint-disable-next-line security/detect-object-injection -- Settled results align with batch order.
        const failedFile = batch[index];
        if (!failedFile) {
          return;
        }

        const apiError =
          result.reason instanceof ApiError
            ? result.reason
            : ApiError.fromUnknown(result.reason, { status: 400 });

        failures.push({
          fileName: failedFile.originalName,
          message: apiError.message,
          code: apiError.code,
          status: apiError.status,
        });
      });
    }

    return { uploads, failures };
  }

  async generateUploadSignature(payload: MediaSignatureBody) {
    return this.cloudinary.generateUploadSignature({
      folder: payload.folder,
      tags: payload.tags,
      eager: payload.eager,
    });
  }

  async warmPopularAssets(limit = 24): Promise<void> {
    try {
      const result = await this.repository.list(
        {
          includeDeleted: false,
        },
        {
          page: 1,
          pageSize: limit,
        },
      );

      const urls = new Set<string>();

      result.items.forEach((record) => {
        const view = this.toAssetView(record as MediaAssetWithUsage);
        [view.secureUrl, view.url].forEach((value) => {
          if (value) {
            urls.add(value);
          }
        });

        Object.values(view.transformations ?? {}).forEach((value) => {
          if (value) {
            urls.add(value);
          }
        });
      });

      if (urls.size === 0) {
        return;
      }

      await this.prefetchUrls([...urls]);
      this.logger.info("Media cache warmup complete", { warmedTargets: urls.size });
    } catch (error) {
      this.logger.warn("Media cache warmup failed", { error });
    }
  }

  private async prefetchUrls(urls: readonly string[]): Promise<void> {
    const candidates = urls.filter(
      (url): url is string => typeof url === "string" && url.trim().length > 0,
    );

    if (candidates.length === 0) {
      return;
    }

    const batches = chunk([...new Set(candidates)], CACHE_PREFETCH_CONCURRENCY);

    // eslint-disable-next-line no-restricted-syntax -- Sequential processing respects concurrency limits.
    for (const batch of batches) {
      if (!Array.isArray(batch) || batch.length === 0) {
        // eslint-disable-next-line no-continue -- Skip empty batches without additional branching.
        continue;
      }
      // eslint-disable-next-line no-await-in-loop -- Batches must resolve sequentially to respect throttling.
      await Promise.all(
        batch.map(async (url) => {
          try {
            const response = await fetch(url, { method: "HEAD" });
            const status = detectCacheStatus(response.headers);
            mediaMetrics.recordCdnPrefetch(status);
          } catch (error) {
            this.logger.debug("Media cache prefetch failed", { error, url });
            mediaMetrics.recordCdnPrefetch("error");
          }
        }),
      );
    }
  }

  private async handleScanFailure(
    error: unknown,
    file: PreparedUploadFile,
    context: UploadContext,
    safeFileName: string,
  ): Promise<void> {
    if (error instanceof ApiError && error.code === "MALWARE_DETECTED") {
      try {
        await this.threats.quarantineUpload(file, context, error.message, {
          code: error.code,
          safeFileName,
        });
      } catch (quarantineError) {
        this.logger.error("Failed to quarantine malicious upload", {
          error: quarantineError,
          safeFileName,
        });
      }
      return;
    }

    this.logger.warn("Media scan failed", {
      error,
      safeFileName,
    });
  }

  private async loadAsset(
    id: string,
    options: { includeUsage?: boolean; includeDeleted?: boolean } = {},
  ): Promise<MediaAssetWithUsage> {
    const args: Omit<Prisma.MediaAssetFindFirstArgs, "where"> | undefined = options.includeUsage
      ? { include: MEDIA_USAGE_INCLUDE }
      : undefined;

    const record = options.includeDeleted
      ? await this.repository.getByIdIncludingDeleted(id, args)
      : await this.repository.getById(id, args);

    if (!record) {
      throw new ApiError("Media asset not found.", {
        status: 404,
        code: "NOT_FOUND",
      });
    }

    return record as MediaAssetWithUsage;
  }

  private toAssetView(
    record: MediaAssetWithUsage,
    uploadResult?: UploadApiResponse,
  ): MediaAssetView {
    const transformations = uploadResult
      ? buildTransformationMap(uploadResult, this.cloudinary, this.config)
      : buildTransformationMapFromAsset(record, this.cloudinary, this.config);

    return {
      id: record.id,
      publicId: record.publicId,
      folder: record.folder,
      format: record.format,
      width: record.width ?? undefined,
      height: record.height ?? undefined,
      bytes: record.bytes,
      url: record.url,
      secureUrl: record.secureUrl,
      metadata: normaliseRecordMetadata(record.metadata ?? undefined),
      resourceType: record.resourceType,
      type: record.type,
      tags: record.tags,
      version: record.version,
      visibility: resolveOutputVisibility(record.visibility),
      transformations,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt ?? undefined,
      usage: mapUsage(record),
    };
  }

  private async processSingleUpload(file: PreparedUploadFile, context: UploadContext) {
    const folder = context.folder ?? this.config.media.cloudinary.folders.products;
    const uploadStart = performance.now();
    let uploadResponse: UploadApiResponse | undefined;
    let safeFileName = file.originalName || "upload";

    try {
      const extension = ensureMimeTypeSupported(resolveMimeExtension(file.mimeType), file.mimeType);
      const sizeLimit = this.resolveSizeLimit(folder);
      enforceFileSizeLimit(file, sizeLimit);

      safeFileName = sanitizeFilename(file.originalName || "upload", extension);

      try {
        await this.scanner.scan({
          buffer: file.buffer,
          filename: safeFileName,
        });
      } catch (error) {
        await this.handleScanFailure(error, file, context, safeFileName);
        throw error;
      }

      uploadResponse = await this.performCloudinaryUpload(file, context, safeFileName, folder);
      const blurDataUrl = await this.generateBlurPlaceholder(uploadResponse);

      const dbRecord = await this.persistUploadedAsset(
        uploadResponse,
        context,
        file,
        folder,
        extension,
        blurDataUrl,
      );

      this.logger.info("Media asset uploaded", {
        id: dbRecord.id,
        publicId: dbRecord.publicId,
        folder: dbRecord.folder,
        uploadedById: context.uploadedById,
      });

      mediaMetrics.recordUploadStatus("success");
      return this.toUploadPayload(dbRecord, uploadResponse);
    } catch (error) {
      if (uploadResponse?.public_id) {
        await this.safeDeleteAsset(uploadResponse.public_id);
      }

      mediaMetrics.recordUploadStatus("failure");
      reportMediaUploadFailure({
        fileName: safeFileName,
        folder,
        status: error instanceof ApiError ? error.status : undefined,
        code: error instanceof ApiError ? error.code : undefined,
        userId: context.uploadedById,
        bytes: file.size,
        errorMessage: error instanceof Error ? error.message : undefined,
      });
      throw error;
    } finally {
      mediaMetrics.observeUploadDuration(folder, performance.now() - uploadStart);
    }
  }

  private async performCloudinaryUpload(
    file: PreparedUploadFile,
    context: UploadContext,
    safeFileName: string,
    folder: string,
  ): Promise<UploadApiResponse> {
    const options: UploadApiOptions & {
      cdn_cache_control?: string;
      cache_control?: string;
    } = {
      folder,
      tags: context.tags,
      filenameOverride: safeFileName,
      useFilename: true,
      uniqueFilename: true,
      mimeType: file.mimeType,
      context: {
        visibility: context.visibility,
        uploader: context.uploadedById,
      },
      metadata: normaliseMetadataValues(context.metadata ?? undefined),
    };

    options.cdn_cache_control = "public, max-age=31536000, immutable";
    options.cache_control = "public, max-age=31536000, immutable";

    try {
      return await this.cloudinary.upload(file.buffer, options);
    } catch (error) {
      mediaMetrics.recordCloudinaryError("upload");
      reportMediaCloudinaryError({
        operation: "upload",
        folder,
        errorMessage: error instanceof Error ? error.message : undefined,
      });
      throw error;
    }
  }

  private async generateBlurPlaceholder(
    uploadResponse: UploadApiResponse,
  ): Promise<string | undefined> {
    if (!uploadResponse.public_id) {
      return undefined;
    }

    const placeholderUrl = this.cloudinary.generateImageUrl(uploadResponse.public_id, {
      transformation: BLUR_PLACEHOLDER_TRANSFORMATION,
      resourceType: resolveResourceType(uploadResponse.resource_type ?? undefined),
      type: resolveAssetType(uploadResponse.type ?? undefined),
      version: uploadResponse.version,
    });

    try {
      const response = await fetch(placeholderUrl, {
        method: "GET",
      });

      if (!response.ok) {
        this.logger.warn("Blur placeholder fetch failed", {
          status: response.status,
          publicId: uploadResponse.public_id,
        });
        return undefined;
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const mimeType = response.headers.get("content-type") ?? "image/webp";
      return `data:${mimeType};base64,${buffer.toString("base64")}`;
    } catch (error) {
      this.logger.warn("Unable to generate blur placeholder", {
        error,
        publicId: uploadResponse.public_id,
      });
      return undefined;
    }
  }

  private async persistUploadedAsset(
    uploadResponse: UploadApiResponse,
    context: UploadContext,
    file: PreparedUploadFile,
    folder: string,
    extension: string,
    blurDataUrl?: string,
  ): Promise<Awaited<ReturnType<MediaRepository["createAsset"]>>> {
    const record = await this.repository.createAsset({
      publicId: uploadResponse.public_id,
      url: uploadResponse.url ?? "",
      secureUrl: uploadResponse.secure_url ?? uploadResponse.url ?? "",
      format: uploadResponse.format ?? extension ?? "bin",
      resourceType: uploadResponse.resource_type ?? "image",
      type: uploadResponse.type ?? "upload",
      width: uploadResponse.width ?? undefined,
      height: uploadResponse.height ?? undefined,
      bytes: uploadResponse.bytes ?? file.size,
      folder: uploadResponse.folder ?? folder,
      version: uploadResponse.version ?? 1,
      tags: uploadResponse.tags ?? normaliseTags(context.tags),
      metadata: buildPersistenceMetadata(uploadResponse, context, file, blurDataUrl),
      visibility: resolvePrismaVisibility(context.visibility),
      uploadedBy: {
        connect: {
          id: context.uploadedById,
        },
      },
    });

    mediaMetrics.recordUploadFormat(uploadResponse.format ?? extension);
    mediaMetrics.recordStorageBytes(record.folder ?? folder, record.bytes);
    return record;
  }

  private toUploadPayload(
    record: Awaited<ReturnType<MediaRepository["createAsset"]>>,
    uploadResult: UploadApiResponse,
  ): UploadedMedia {
    const transformations = buildTransformationMap(uploadResult, this.cloudinary, this.config);

    return {
      id: record.id,
      publicId: record.publicId,
      folder: record.folder,
      format: record.format,
      width: record.width ?? undefined,
      height: record.height ?? undefined,
      bytes: record.bytes,
      url: record.url,
      secureUrl: record.secureUrl,
      metadata: normaliseRecordMetadata(record.metadata ?? undefined),
      resourceType: record.resourceType,
      type: record.type,
      tags: record.tags,
      version: record.version,
      visibility: resolveOutputVisibility(record.visibility),
      transformations,
    };
  }

  private resolveSizeLimit(folder: string): number {
    if (folder === this.config.media.cloudinary.folders.banners) {
      return MAX_BANNER_BYTES;
    }

    return MAX_PRODUCT_BYTES;
  }

  private async safeDeleteAsset(publicId: string): Promise<void> {
    try {
      await this.cloudinary.deleteAsset(publicId, { invalidate: true });
    } catch (error) {
      mediaMetrics.recordCloudinaryError("delete");
      reportMediaCloudinaryError({
        operation: "delete",
        publicId,
        errorMessage: error instanceof Error ? error.message : undefined,
      });
      this.logger.warn("Failed to cleanup Cloudinary asset after upload failure", {
        error,
        publicId,
      });
    }
  }
}

export const mediaServiceInternals = {
  chunk,
  normaliseTags,
  resolveMimeExtension,
  buildTransformationMap,
  buildTransformationMapFromAsset,
  extractDominantColor,
  calculateAspectRatio,
  normaliseMetadataValues,
  normaliseRecordMetadata,
  mapUsage,
  buildPersistenceMetadata,
  ensureMimeTypeSupported,
  enforceFileSizeLimit,
};
