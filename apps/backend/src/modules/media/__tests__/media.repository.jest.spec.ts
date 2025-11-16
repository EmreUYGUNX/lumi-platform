import { describe, expect, it, jest } from "@jest/globals";
import { MediaVisibility } from "@prisma/client";
import type { Prisma, PrismaClient } from "@prisma/client";

import { MediaRepository, mediaRepositoryInternals } from "../media.repository.js";
import type { MediaListFilters } from "../media.repository.js";

const buildWhere = (filters: MediaListFilters = {}): Prisma.MediaAssetWhereInput =>
  mediaRepositoryInternals.buildWhereClause(filters);

describe("media.repository buildWhereClause", () => {
  it("maps direct equality filters", () => {
    const where = buildWhere({
      uploadedById: "user_1",
      folder: "lumi/products",
      tag: "hero",
      resourceType: "image",
    });

    expect(where.uploadedById).toBe("user_1");
    expect(where.folder).toEqual({ equals: "lumi/products", mode: "insensitive" });
    expect(where.resourceType).toEqual({ equals: "image", mode: "insensitive" });
    expect(where.tags).toEqual({ hasEvery: ["hero"] });
  });

  it("supports product and variant relations", () => {
    const where = buildWhere({
      productId: "prod_1",
      productVariantId: "variant_2",
    });

    expect(where.products).toEqual({ some: { id: "prod_1" } });
    expect(where.productVariants).toEqual({ some: { id: "variant_2" } });
  });

  it("handles fuzzy search across publicId, folder, and tags", () => {
    const where = buildWhere({ search: "  banner  " });
    expect(where.OR).toEqual([
      { publicId: { contains: "banner", mode: "insensitive" } },
      { folder: { contains: "banner", mode: "insensitive" } },
      { tags: { has: "banner" } },
    ]);
  });

  it("ignores blank search parameters", () => {
    const where = buildWhere({ search: "   " });
    expect(where.OR).toBeUndefined();
  });

  it("applies access filters for owner and visibility allowlists", () => {
    const where = buildWhere({
      access: {
        ownerId: "user_1",
        visibilities: [MediaVisibility.PUBLIC, MediaVisibility.INTERNAL],
      },
    });

    expect(where.AND).toEqual([
      {
        OR: [
          { uploadedById: "user_1" },
          {
            visibility: {
              in: [MediaVisibility.PUBLIC, MediaVisibility.INTERNAL],
            },
          },
        ],
      },
    ]);
  });
});

describe("media.repository list", () => {
  it("paginates includeDeleted queries with explicit options", async () => {
    const count = jest.fn().mockResolvedValue(3 as never);
    const findMany = jest.fn().mockResolvedValue([
      {
        id: "asset_1",
        folder: "lumi/products",
      },
    ] as never);

    const prismaMock: {
      mediaAsset: {
        count: typeof count;
        findMany: typeof findMany;
      };
      $transaction: (callback: (client: PrismaClient) => Promise<unknown>) => Promise<unknown>;
    } = {
      mediaAsset: {
        count,
        findMany,
      },
      $transaction: async (callback) => callback(prismaMock as unknown as PrismaClient),
    };

    const repository = new MediaRepository(prismaMock as unknown as PrismaClient);

    const result = await repository.list(
      { includeDeleted: true, folder: "lumi/products" },
      { page: 2, pageSize: 1 },
    );

    expect(count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          folder: { equals: "lumi/products", mode: "insensitive" },
        }),
      }),
    );
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 1,
        skip: 1,
        where: expect.objectContaining({
          folder: { equals: "lumi/products", mode: "insensitive" },
        }),
      }),
    );
    expect(result.meta).toEqual({
      page: 2,
      pageSize: 1,
      totalItems: 3,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true,
    });
  });
});

describe("media.repository mutations", () => {
  it("fetches records including soft-deleted entries", async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: "asset_1" } as never);
    const prisma = {
      mediaAsset: {
        findFirst,
      },
      $transaction: async (callback: (client: PrismaClient) => Promise<unknown>) =>
        callback({ mediaAsset: { findFirst } } as unknown as PrismaClient),
    };

    const repository = new MediaRepository(prisma as unknown as PrismaClient);
    const result = await repository.getByIdIncludingDeleted("asset_1");

    expect(findFirst).toHaveBeenCalledWith({ where: { id: "asset_1" } });
    expect(result).toEqual({ id: "asset_1" });
  });

  it("force deletes records regardless of soft delete state", async () => {
    const deleteMock = jest.fn().mockResolvedValue({ id: "asset_1" } as never);
    const prisma = {
      mediaAsset: {
        delete: deleteMock,
      },
      $transaction: async (callback: (client: PrismaClient) => Promise<unknown>) =>
        callback({
          mediaAsset: {
            delete: deleteMock,
          },
        } as unknown as PrismaClient),
    };

    const repository = new MediaRepository(prisma as unknown as PrismaClient);
    const result = await repository.forceDeleteAsset("asset_1");

    expect(deleteMock).toHaveBeenCalledWith({ where: { id: "asset_1" } });
    expect(result).toEqual({ id: "asset_1" });
  });
});
