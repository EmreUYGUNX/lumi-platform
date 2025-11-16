import type { MediaAsset, PrismaClient } from "@prisma/client";

import type { CloudinaryClient } from "@/integrations/cloudinary/cloudinary.client.js";
import { runMediaTransformationJob } from "@/jobs/media-transformation.job.js";
import type { MediaRepository } from "@/modules/media/media.repository.js";

const createAsset = (overrides: Partial<MediaAsset> = {}): MediaAsset => ({
  id: "asset_1",
  publicId: "public_1",
  url: "",
  secureUrl: "",
  format: "jpg",
  resourceType: "image",
  type: "upload",
  width: 100,
  height: 100,
  bytes: 1000,
  folder: "folder",
  version: 1,
  tags: [],
  metadata: {},
  uploadedById: "user_1",
  // eslint-disable-next-line unicorn/no-null -- testing null persistence.
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("runMediaTransformationJob", () => {
  it("regenerates transformations for assets", async () => {
    const assets = [
      createAsset({ id: "asset_1", publicId: "p1" }),
      createAsset({ id: "asset_2", publicId: "p2" }),
    ];
    const prisma = {
      mediaAsset: {
        findMany: jest.fn().mockResolvedValueOnce(assets).mockResolvedValueOnce([]),
      },
    } as unknown as PrismaClient;

    const repository: Partial<MediaRepository> = {
      updateMetadata: jest.fn(),
    };

    const cloudinary: Partial<CloudinaryClient> = {
      regenerateAsset: jest.fn().mockResolvedValue({
        version: 2,
      }),
    };

    const result = await runMediaTransformationJob(
      { batchSize: 2 },
      {
        prisma,
        repository: repository as MediaRepository,
        cloudinary: cloudinary as CloudinaryClient,
      },
    );

    expect(cloudinary.regenerateAsset).toHaveBeenCalledTimes(2);
    expect(repository.updateMetadata).toHaveBeenCalledTimes(2);
    expect(result.processed).toBe(2);
    expect(result.succeeded).toBe(2);
  });

  it("records failures when Cloudinary regeneration throws errors", async () => {
    const assets = [createAsset({ id: "asset_err", publicId: "p_err" })];
    const prisma = {
      mediaAsset: {
        findMany: jest.fn().mockResolvedValueOnce(assets).mockResolvedValueOnce([]),
      },
    } as unknown as PrismaClient;

    const repository: Partial<MediaRepository> = {
      updateMetadata: jest.fn(),
    };

    const cloudinary: Partial<CloudinaryClient> = {
      regenerateAsset: jest.fn().mockRejectedValue(new Error("regen failure")),
    };

    const loggerModule = await import("@/lib/logger.js");
    const loggerStub = {
      error: jest.fn(),
      info: jest.fn(),
    };
    const childLoggerSpy = jest
      .spyOn(loggerModule, "createChildLogger")
      .mockReturnValue(loggerStub as unknown as ReturnType<typeof loggerModule.createChildLogger>);

    try {
      const result = await runMediaTransformationJob(
        { batchSize: 1 },
        {
          prisma,
          repository: repository as MediaRepository,
          cloudinary: cloudinary as CloudinaryClient,
        },
      );

      expect(result.failed).toBe(1);
      expect(repository.updateMetadata).not.toHaveBeenCalled();
      expect(loggerStub.error).toHaveBeenCalledWith(
        "Failed to regenerate media transformations",
        expect.objectContaining({
          assetId: "asset_err",
          publicId: "p_err",
        }),
      );
    } finally {
      childLoggerSpy.mockRestore();
    }
  });

  it("stops processing when the cursor cannot be determined", async () => {
    const assets = [createAsset({ id: "" as unknown as string })];
    const prisma = {
      mediaAsset: {
        findMany: jest.fn().mockResolvedValueOnce(assets),
      },
    } as unknown as PrismaClient;

    const repository: Partial<MediaRepository> = {
      updateMetadata: jest.fn(),
    };

    const cloudinary: Partial<CloudinaryClient> = {
      regenerateAsset: jest.fn().mockResolvedValue({
        version: 3,
      }),
    };

    const result = await runMediaTransformationJob(
      { batchSize: 1, maxBatches: 5 },
      {
        prisma,
        repository: repository as MediaRepository,
        cloudinary: cloudinary as CloudinaryClient,
      },
    );

    expect(prisma.mediaAsset.findMany).toHaveBeenCalledTimes(1);
    expect(result.batches).toBe(1);
  });
});
