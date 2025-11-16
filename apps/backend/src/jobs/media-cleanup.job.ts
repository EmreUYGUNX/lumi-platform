import type { Prisma, PrismaClient } from "@prisma/client";

import { createChildLogger } from "@/lib/logger.js";
import { getPrismaClient } from "@/lib/prisma.js";
import { MediaRepository } from "@/modules/media/media.repository.js";

const DEFAULT_MAX_BATCH = 200;
const AGE_THRESHOLD_DAYS = 30;

export interface MediaCleanupJobOptions {
  dryRun?: boolean;
  limit?: number;
  triggeredBy?: string;
}

export interface MediaCleanupJobDependencies {
  prisma?: PrismaClient;
  repository?: MediaRepository;
}

export interface MediaCleanupJobResult {
  orphansFound: number;
  orphansDeleted: number;
  agedAssetCount: number;
  cutoffDate: string;
  dryRun: boolean;
  durationMs: number;
}

export const runMediaCleanupJob = async (
  options: MediaCleanupJobOptions = {},
  dependencies: MediaCleanupJobDependencies = {},
): Promise<MediaCleanupJobResult> => {
  const logger = createChildLogger("media:jobs:cleanup");
  const prisma = dependencies.prisma ?? getPrismaClient();
  const repository = dependencies.repository ?? new MediaRepository(prisma);
  const start = Date.now();

  const limit = Math.max(1, Math.min(options.limit ?? DEFAULT_MAX_BATCH, 500));
  const dryRun = options.dryRun ?? false;
  const cutoff = new Date(Date.now() - AGE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);

  const orphans = await repository.findOrphans(limit);
  const agedAssetCount = await prisma.mediaAsset.count({
    where: {
      deletedAt: {
        equals: Prisma.DbNull,
      },
      createdAt: {
        lt: cutoff,
      },
    },
  });

  let deleted = 0;
  if (!dryRun) {
    await Promise.all(orphans.map((asset) => repository.softDeleteAsset(asset.id)));
    deleted = orphans.length;
  }

  const durationMs = Date.now() - start;

  logger.info("Media cleanup job completed", {
    dryRun,
    orphansFound: orphans.length,
    orphansDeleted: deleted,
    agedAssetCount,
    triggeredBy: options.triggeredBy,
    durationMs,
  });

  return {
    orphansFound: orphans.length,
    orphansDeleted: dryRun ? 0 : deleted,
    agedAssetCount,
    cutoffDate: cutoff.toISOString(),
    dryRun,
    durationMs,
  };
};
