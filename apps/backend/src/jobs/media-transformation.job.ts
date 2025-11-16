import type { MediaAsset, Prisma, PrismaClient } from "@prisma/client";
import type { UploadApiResponse } from "cloudinary";

import {
  type CloudinaryClient,
  getCloudinaryClient,
} from "@/integrations/cloudinary/cloudinary.client.js";
import { createChildLogger } from "@/lib/logger.js";
import { getPrismaClient } from "@/lib/prisma.js";
import { MediaRepository } from "@/modules/media/media.repository.js";

const DEFAULT_BATCH_SIZE = 100;

export interface MediaTransformationJobOptions {
  batchSize?: number;
  maxBatches?: number;
  cursor?: string;
  triggeredBy?: string;
}

export interface MediaTransformationJobDependencies {
  prisma?: PrismaClient;
  repository?: MediaRepository;
  cloudinary?: CloudinaryClient;
}

export interface MediaTransformationJobResult {
  processed: number;
  succeeded: number;
  failed: number;
  batches: number;
  lastCursor?: string;
  durationMs: number;
}

const mergeMetadata = (
  current: MediaAsset["metadata"],
  patch: Record<string, unknown>,
): Record<string, unknown> => {
  const base =
    current && typeof current === "object" && !Array.isArray(current)
      ? (current as Record<string, unknown>)
      : {};
  return { ...base, ...patch };
};

const updateAssetFromResponse = (
  repository: MediaRepository,
  asset: MediaAsset,
  response: UploadApiResponse,
) => {
  const metadata = mergeMetadata(asset.metadata, {
    regeneration: {
      version: response.version,
      regeneratedAt: new Date().toISOString(),
    },
  });

  return repository.updateMetadata(asset.id, {
    version: response.version ?? asset.version,
    width: response.width ?? asset.width ?? undefined,
    height: response.height ?? asset.height ?? undefined,
    bytes: response.bytes ?? asset.bytes,
    url: response.url ?? asset.url,
    secureUrl: response.secure_url ?? response.url ?? asset.secureUrl,
    format: response.format ?? asset.format,
    metadata,
  });
};

export const runMediaTransformationJob = async (
  options: MediaTransformationJobOptions = {},
  dependencies: MediaTransformationJobDependencies = {},
): Promise<MediaTransformationJobResult> => {
  const logger = createChildLogger("media:jobs:transformations");
  const {
    prisma: prismaOverride,
    repository: repositoryOverride,
    cloudinary: cloudinaryOverride,
  } = dependencies;
  const prisma = prismaOverride ?? getPrismaClient();
  const repository = repositoryOverride ?? new MediaRepository(prisma);
  const cloudinary = cloudinaryOverride ?? getCloudinaryClient();

  const batchSize = Math.max(1, Math.min(options.batchSize ?? DEFAULT_BATCH_SIZE, 250));
  const maxBatches = Math.max(1, options.maxBatches ?? Number.POSITIVE_INFINITY);

  const { cursor: initialCursor } = options;
  let cursor = initialCursor;
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let batches = 0;
  const fetchBatch = async (cursorId?: string) => {
    const cursorFilter = cursorId
      ? {
          skip: 1,
          cursor: {
            id: cursorId,
          },
        }
      : {};

    return prisma.mediaAsset.findMany({
      where: {
        deletedAt: {
          equals: Prisma.DbNull,
        },
      },
      orderBy: {
        createdAt: "asc",
      },
      take: batchSize,
      ...cursorFilter,
    });
  };

  const regenerateAsset = async (asset: MediaAsset) => {
    try {
      const response = await cloudinary.regenerateAsset(asset.publicId, {
        resourceType: asset.resourceType,
        type: asset.type,
        invalidate: true,
      });
      await updateAssetFromResponse(repository, asset, response);
      return { succeeded: 1, failed: 0 };
    } catch (error) {
      logger.error("Failed to regenerate media transformations", {
        assetId: asset.id,
        publicId: asset.publicId,
        error,
      });
      return { succeeded: 0, failed: 1 };
    }
  };

  const processBatchSequentially = async (assets: MediaAsset[]) => {
    let succeededCount = 0;
    let failedCount = 0;

    // eslint-disable-next-line no-restricted-syntax -- sequential processing maintains API fairness.
    for (const asset of assets) {
      // eslint-disable-next-line no-await-in-loop -- regeneration must occur sequentially to respect rate limits.
      const result = await regenerateAsset(asset);
      succeededCount += result.succeeded;
      failedCount += result.failed;
    }

    return {
      processedCount: assets.length,
      succeededCount,
      failedCount,
    };
  };

  const start = Date.now();

  const executeBatches = async () => {
    while (batches < maxBatches) {
      // eslint-disable-next-line no-await-in-loop -- batching depends on sequential fetching.
      const assets = await fetchBatch(cursor);

      if (assets.length === 0) {
        break;
      }

      // eslint-disable-next-line no-await-in-loop -- sequential updates avoid conflicting writes.
      const batchResult = await processBatchSequentially(assets);
      processed += batchResult.processedCount;
      succeeded += batchResult.succeededCount;
      failed += batchResult.failedCount;

      batches += 1;
      cursor = assets.at(-1)?.id;
      if (!cursor) {
        break;
      }
    }
  };

  await executeBatches();

  const durationMs = Date.now() - start;

  logger.info("Media transformation regeneration completed", {
    processed,
    succeeded,
    failed,
    batches,
    lastCursor: cursor,
    triggeredBy: options.triggeredBy,
    durationMs,
  });

  return {
    processed,
    succeeded,
    failed,
    batches,
    lastCursor: cursor,
    durationMs,
  };
};
