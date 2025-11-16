import type { PrismaClient } from "@prisma/client";

import { runMediaCleanupJob } from "@/jobs/media-cleanup.job.js";
import type { MediaRepository } from "@/modules/media/media.repository.js";

describe("runMediaCleanupJob", () => {
  it("soft deletes orphaned assets when not in dry run", async () => {
    const repository: Partial<MediaRepository> = {
      findOrphans: jest.fn().mockResolvedValue([{ id: "asset_1" }]),
      softDeleteAsset: jest.fn().mockResolvedValue({} as never),
    };
    const prisma = {
      mediaAsset: {
        count: jest.fn().mockResolvedValue(3),
      },
    } as unknown as PrismaClient;

    const result = await runMediaCleanupJob(
      { dryRun: false },
      {
        repository: repository as MediaRepository,
        prisma,
      },
    );

    expect(repository.findOrphans).toHaveBeenCalled();
    expect(repository.softDeleteAsset).toHaveBeenCalledWith("asset_1");
    expect(result.orphansDeleted).toBe(1);
    expect(result.agedAssetCount).toBe(3);
  });

  it("does not delete assets in dry run mode", async () => {
    const repository: Partial<MediaRepository> = {
      findOrphans: jest.fn().mockResolvedValue([{ id: "asset_1" }]),
      softDeleteAsset: jest.fn(),
    };
    const prisma = {
      mediaAsset: {
        count: jest.fn().mockResolvedValue(0),
      },
    } as unknown as PrismaClient;

    const result = await runMediaCleanupJob(
      { dryRun: true },
      {
        repository: repository as MediaRepository,
        prisma,
      },
    );

    expect(repository.softDeleteAsset).not.toHaveBeenCalled();
    expect(result.orphansDeleted).toBe(0);
  });

  it("falls back to default dependencies and clamps oversized batches", async () => {
    const repository = {
      findOrphans: jest.fn().mockResolvedValue([{ id: "asset_2" }]),
      softDeleteAsset: jest.fn().mockResolvedValue({}),
    };
    const prisma = {
      mediaAsset: {
        count: jest.fn().mockResolvedValue(4),
      },
    } as unknown as PrismaClient;

    const prismaModule = await import("@/lib/prisma.js");
    const getPrismaClientSpy = jest.spyOn(prismaModule, "getPrismaClient").mockReturnValue(prisma);

    const repositoryModule = await import("@/modules/media/media.repository.js");
    const repositorySpy = jest
      .spyOn(repositoryModule, "MediaRepository")
      .mockImplementation(() => repository as unknown as MediaRepository);

    try {
      const result = await runMediaCleanupJob({ limit: 1000 });

      expect(getPrismaClientSpy).toHaveBeenCalled();
      expect(repositorySpy).toHaveBeenCalledWith(prisma);
      expect(repository.findOrphans).toHaveBeenCalledWith(500);
      expect(repository.softDeleteAsset).toHaveBeenCalledWith("asset_2");
      expect(result.orphansDeleted).toBe(1);
    } finally {
      getPrismaClientSpy.mockRestore();
      repositorySpy.mockRestore();
    }
  });
});
