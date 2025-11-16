/* eslint-disable import/no-extraneous-dependencies */
import { jest } from "@jest/globals";
import express from "express";
import type { Express, NextFunction, Request, Response } from "express";

import { ApiError } from "@/errors/api-error.js";
import { createMediaRouter } from "@/modules/media/media.router.js";
import type {
  MediaActionContext,
  MediaAssetView,
  MediaListResult,
  MediaService,
  MediaUploadResult,
  PreparedUploadFile,
  UploadedMedia,
} from "@/modules/media/media.service.js";
import type { MediaListQuery, MediaUploadBody } from "@/modules/media/media.validators.js";
import type { ApplicationConfig } from "@lumi/types";

import { createTestConfig } from "../../src/testing/config.js";

const ALLOWED_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const PRODUCT_LIMIT_BYTES = 5 * 1024 * 1024;
const BANNER_LIMIT_BYTES = 10 * 1024 * 1024;

const createTransformations = (publicId: string) => ({
  original: `https://res.cloudinary.com/lumi-test/image/upload/${publicId}`,
  thumbnail: `https://res.cloudinary.com/lumi-test/image/upload/w_300,h_300,c_fill/${publicId}`,
  medium: `https://res.cloudinary.com/lumi-test/image/upload/w_800,h_800,c_limit/${publicId}`,
  large: `https://res.cloudinary.com/lumi-test/image/upload/w_1920,c_limit/${publicId}`,
});

const generateCuid = () => {
  const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
  let value = "ck";
  while (value.length < 25) {
    const index = Math.floor(Math.random() * alphabet.length);
    // eslint-disable-next-line security/detect-object-injection
    value += alphabet[index]!;
  }
  return value;
};

/* eslint-disable sonarjs/cognitive-complexity */
export const createMediaAssetFixture = (
  overrides: Partial<MediaAssetView> = {},
): MediaAssetView => {
  const publicId =
    overrides.publicId ??
    `lumi/products/${(overrides.id ?? generateCuid()).replaceAll(/[^\da-z]/gi, "").slice(0, 12)}`;

  const base: MediaAssetView = {
    id: overrides.id ?? generateCuid(),
    publicId,
    folder: overrides.folder ?? "lumi/products",
    format: overrides.format ?? "png",
    width: overrides.width ?? 1200,
    height: overrides.height ?? 1200,
    bytes: overrides.bytes ?? 256_000,
    url: overrides.url ?? `https://cdn.lumi.test/${publicId}.png`,
    secureUrl: overrides.secureUrl ?? `https://cdn.lumi.test/${publicId}.png`,
    metadata: overrides.metadata ?? { blurDataUrl: "data:image/webp;base64,AAA" },
    resourceType: overrides.resourceType ?? "image",
    type: overrides.type ?? "upload",
    tags: overrides.tags ?? ["hero"],
    version: overrides.version ?? 1,
    visibility: overrides.visibility ?? "public",
    transformations: overrides.transformations ?? createTransformations(publicId),
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
    deletedAt: overrides.deletedAt,
    usage: overrides.usage ?? { products: [], variants: [] },
  };

  return base;
};
/* eslint-enable sonarjs/cognitive-complexity */

const toUploadedMedia = (asset: MediaAssetView): UploadedMedia => {
  const { createdAt, updatedAt, deletedAt, usage, ...rest } = asset;
  return rest;
};

const isPrivileged = (actor?: MediaActionContext): boolean =>
  Boolean(actor?.roles.some((role) => role === "admin" || role === "staff"));

const resolveSizeLimit = (folder: string, config: ApplicationConfig): number =>
  folder === config.media.cloudinary.folders.banners ? BANNER_LIMIT_BYTES : PRODUCT_LIMIT_BYTES;

const sanitizeFileName = (name: string): string => {
  const trimmed = name.trim().toLowerCase();
  const safe = trimmed.replaceAll(/[^\w.-]/gi, "-");
  return safe.replaceAll(/-+/g, "-");
};

export interface MediaServiceMockOptions {
  config: ApplicationConfig;
  initialAssets?: MediaAssetView[];
}

// eslint-disable-next-line sonarjs/cognitive-complexity
export const createMediaServiceMock = ({ config, initialAssets = [] }: MediaServiceMockOptions) => {
  const assets = new Map<string, MediaAssetView>();
  initialAssets.forEach((asset) => assets.set(asset.id, asset));

  const findAssetOrThrow = (id: string): MediaAssetView => {
    const asset = assets.get(id);
    if (!asset) {
      throw new ApiError("Media asset not found.", { status: 404, code: "NOT_FOUND" });
    }
    return asset;
  };

  const listAssets = jest.fn(async (query?: MediaListQuery): Promise<MediaListResult> => {
    const page = query?.page ?? 1;
    const pageSize = query?.perPage ?? 25;
    const offset = (page - 1) * pageSize;
    const search = query?.search?.toLowerCase();
    const includeDeleted = query?.includeDeleted ?? false;

    const filtered = [...assets.values()].filter(
      (asset) =>
        (includeDeleted || !asset.deletedAt) &&
        (!query?.folder || asset.folder === query.folder) &&
        (!search || asset.publicId.toLowerCase().includes(search)) &&
        (!query?.tag || asset.tags.includes(query.tag)),
    );

    const items = filtered.slice(offset, offset + pageSize);
    return {
      items,
      meta: {
        page,
        pageSize,
        totalItems: filtered.length,
        totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)),
        hasNextPage: offset + pageSize < filtered.length,
        hasPreviousPage: page > 1,
      },
    };
  });

  const upload = jest.fn(
    async (files: PreparedUploadFile[], context: MediaUploadBody & { uploadedById: string }) => {
      const uploads: UploadedMedia[] = [];

      files.forEach((file, index) => {
        if (!ALLOWED_MIMES.has(file.mimeType)) {
          throw new ApiError("File type not supported", {
            status: 415,
            code: "INVALID_MIME_TYPE",
          });
        }

        const folder = context.folder ?? config.media.cloudinary.folders.products;
        const sizeLimit = resolveSizeLimit(folder, config);
        if (file.size > sizeLimit) {
          throw new ApiError("File exceeds folder size policy.", {
            status: 413,
            code: "PAYLOAD_TOO_LARGE",
          });
        }

        const safeName =
          sanitizeFileName(file.originalName ?? `upload-${index}`) || `upload-${index}`;
        const id = generateCuid();
        const publicId = `${folder}/${safeName}-${id.slice(0, 8)}`;

        const asset = createMediaAssetFixture({
          id,
          publicId,
          folder,
          tags: context.tags ?? [],
          metadata: {
            ...context.metadata,
            blurDataUrl: "data:image/webp;base64,AAA",
          },
          visibility: context.visibility ?? "public",
          bytes: file.size,
          format: file.mimeType.split("/").at(-1) ?? "jpg",
        });

        assets.set(asset.id, asset);
        uploads.push(toUploadedMedia(asset));
      });

      return {
        uploads,
        failures: [],
      } satisfies MediaUploadResult;
    },
  );

  const softDeleteAsset = jest.fn(async (id: string) => {
    const asset = findAssetOrThrow(id);
    if ((asset.usage.products?.length ?? 0) > 0 || (asset.usage.variants?.length ?? 0) > 0) {
      throw new ApiError("Media asset is in use and cannot be deleted.", {
        status: 409,
        code: "ASSET_IN_USE",
      });
    }

    const deleted = {
      ...asset,
      deletedAt: new Date(),
      updatedAt: new Date(),
    };
    assets.set(id, deleted);
    return deleted;
  });

  const hardDeleteAsset = jest.fn(async (id: string, actor?: MediaActionContext) => {
    if (!isPrivileged(actor)) {
      throw new ApiError("Forbidden", { status: 403 });
    }

    const asset = findAssetOrThrow(id);
    assets.delete(id);
    return asset;
  });

  const getAsset = jest.fn(async (id: string) => findAssetOrThrow(id));

  const updateAsset = jest.fn(async (id: string, payload: Partial<MediaUploadBody>) => {
    const asset = findAssetOrThrow(id);
    const updated = {
      ...asset,
      ...payload,
      tags: payload.tags ?? asset.tags,
      metadata: payload.metadata ?? asset.metadata,
      folder: payload.folder ?? asset.folder,
      updatedAt: new Date(),
    };
    assets.set(id, updated);
    return updated;
  });

  const regenerateAsset = jest.fn(async (id: string) => findAssetOrThrow(id));

  const service: jest.Mocked<MediaService> = {
    upload,
    listAssets,
    getAsset,
    updateAsset,
    regenerateAsset,
    softDeleteAsset,
    hardDeleteAsset,
    generateUploadSignature: jest.fn(async () => ({
      signature: "signature",
      timestamp: Date.now(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      folder: config.media.cloudinary.folders.products,
      apiKey: "cloudinary-api-key",
      cloudName: "lumi-test",
      params: { folder: config.media.cloudinary.folders.products },
    })),
    getAuditEntity: jest.fn(() => "media.assets"),
    warmPopularAssets: jest.fn(async () => {}),
  } as unknown as jest.Mocked<MediaService>;

  return { service, assets };
};

export interface MediaTestHarness {
  app: Express;
  config: ApplicationConfig;
  service: jest.Mocked<MediaService>;
  assets: Map<string, MediaAssetView>;
  auditTrail: Record<string, unknown>[];
}

export interface MediaTestHarnessOptions {
  initialAssets?: MediaAssetView[];
  configOverrides?: Record<string, unknown>;
}

export const createMediaTestHarness = (options: MediaTestHarnessOptions = {}): MediaTestHarness => {
  const config = createTestConfig(options.configOverrides);
  const { service, assets } = createMediaServiceMock({
    config,
    initialAssets: options.initialAssets,
  });

  const app = express();
  const auditTrail: Record<string, unknown>[] = [];

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use((req, res, next) => {
    res.on("finish", () => {
      if (res.locals?.audit) {
        auditTrail.push(JSON.parse(JSON.stringify(res.locals.audit)));
      }
    });
    next();
  });

  app.use("/api/v1", createMediaRouter(config, { service }));

  app.use(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Express requires four params to detect error handler.
    (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
      const typedError = error as ApiError & { statusCode?: number };
      const statusCandidate =
        typeof typedError?.status === "number" ? typedError.status : undefined;
      const status =
        statusCandidate ??
        (typeof typedError?.statusCode === "number" ? typedError.statusCode : 500);
      const resolvedCode =
        typeof typedError?.code === "string"
          ? typedError.code
          : status === 401
            ? "UNAUTHORIZED"
            : status === 403
              ? "FORBIDDEN"
              : "INTERNAL_SERVER_ERROR";
      const message =
        typeof (error as Error)?.message === "string"
          ? (error as Error).message
          : "Internal Server Error";

      res.status(status).json({
        success: false,
        error: {
          code: resolvedCode,
          message,
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    },
  );

  return {
    app,
    config,
    service,
    assets,
    auditTrail,
  };
};
