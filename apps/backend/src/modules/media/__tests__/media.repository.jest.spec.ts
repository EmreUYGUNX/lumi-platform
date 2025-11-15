import { describe, expect, it, jest } from "@jest/globals";
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
    });

    expect(where.uploadedById).toBe("user_1");
    expect(where.folder).toEqual({ equals: "lumi/products", mode: "insensitive" });
    expect(where.tags).toEqual({ has: "hero" });
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
