import { beforeAll, describe, expect, it } from "@jest/globals";
import type { PrismaClient } from "@prisma/client";
import { ProductStatus } from "@prisma/client";

import { ProductRepository } from "@/modules/product/product.repository.js";

import { createCategory, createMedia, createProductBundle } from "../../fixtures/index.js";
import { getTestDatabaseManager } from "../../helpers/db.js";

describe("ProductRepository (database)", () => {
  const testDatabase = getTestDatabaseManager();
  let prisma: PrismaClient;
  let repository: ProductRepository;

  beforeAll(async () => {
    prisma = await testDatabase.getPrismaClient();
    repository = new ProductRepository(prisma);
  });

  it("applies search filters and pagination metadata", async () => {
    const primaryCategory = await createCategory(prisma);
    const { product: featured } = await createProductBundle(prisma, {
      category: primaryCategory,
      status: ProductStatus.ACTIVE,
      price: 199,
    });
    await createProductBundle(prisma, {
      status: ProductStatus.DRAFT,
      searchKeywords: ["unlisted"],
    });

    const term = featured.title.split(" ").at(0) ?? featured.title;
    const result = await repository.search(
      {
        term,
        statuses: [ProductStatus.ACTIVE],
        categoryIds: [primaryCategory.id],
      },
      { page: 1, pageSize: 5 },
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe(featured.id);
    expect(result.meta.totalItems).toBe(1);
    expect(result.meta.totalPages).toBe(1);
  });

  it("supports cursor pagination for catalogue listings", async () => {
    const category = await createCategory(prisma);
    const bundles = await Promise.all(
      Array.from({ length: 3 }).map(() =>
        createProductBundle(prisma, { category, status: ProductStatus.ACTIVE }),
      ),
    );

    const result = await repository.searchWithCursor(
      { categoryIds: [category.id] },
      {
        take: 2,
      },
    );

    expect(result.items).toHaveLength(2);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBeDefined();

    const remainingIds = new Set(bundles.map((bundle) => bundle.product.id));
    result.items.forEach((item) => remainingIds.delete(item.id));
    expect(remainingIds.size).toBeGreaterThan(0);
  });

  it("manages media associations within transactions", async () => {
    const { product } = await createProductBundle(prisma);
    const media = await createMedia(prisma);

    await repository.attachMedia(product.id, media.id, 1);
    const attached = await prisma.productMedia.findUnique({
      where: { productId_mediaId: { productId: product.id, mediaId: media.id } },
    });
    expect(attached?.sortOrder).toBe(1);

    await repository.detachMedia(product.id, media.id);
    const removed = await prisma.productMedia.findUnique({
      where: { productId_mediaId: { productId: product.id, mediaId: media.id } },
    });
    expect(removed).toBeNull();
  });
});
