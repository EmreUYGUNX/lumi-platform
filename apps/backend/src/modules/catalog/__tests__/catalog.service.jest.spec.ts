/* eslint-disable
  @typescript-eslint/ban-ts-comment,
  @typescript-eslint/no-explicit-any,
  unicorn/no-useless-undefined,
  no-use-before-define,
  unused-imports/no-unused-imports,
  unicorn/no-null
*/
// @ts-nocheck
import { describe, expect, it, jest } from "@jest/globals";
import { Prisma } from "@prisma/client";

import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors.js";
import type { CategoryNode } from "@/modules/category/category.repository.js";

import type { CatalogCache } from "../catalog.cache.js";
import { CatalogService } from "../catalog.service.js";

const createCatalogCacheStub = (): CatalogCache & {
  getCalls: jest.Mock;
  setCalls: jest.Mock;
  categoryGetCalls: jest.Mock;
  categorySetCalls: jest.Mock;
} => {
  const store = new Map<string, unknown>();
  const categoryStore = new Map<string, unknown>();
  const getCalls = jest.fn();
  const setCalls = jest.fn();
  const categoryGetCalls = jest.fn();
  const categorySetCalls = jest.fn();

  return {
    getCalls,
    setCalls,
    categoryGetCalls,
    categorySetCalls,
    async getProductList(key) {
      getCalls(key);
      return store.get(key) as unknown;
    },
    async setProductList(key, value) {
      setCalls(key, value);
      store.set(key, value);
    },
    async invalidateProductLists() {
      store.clear();
    },
    async getCategoryTree(key) {
      categoryGetCalls(key);
      return categoryStore.get(key) as unknown;
    },
    async setCategoryTree(key, value) {
      categorySetCalls(key, value);
      categoryStore.set(key, value);
    },
    async invalidateCategoryTrees() {
      categoryStore.clear();
    },
    async shutdown() {
      store.clear();
      categoryStore.clear();
    },
  } as unknown as CatalogCache & {
    getCalls: jest.Mock;
    setCalls: jest.Mock;
    categoryGetCalls: jest.Mock;
    categorySetCalls: jest.Mock;
  };
};

const createProductRepositoryStub = (prisma: ReturnType<typeof createPrismaStub>) => {
  const search = jest.fn().mockResolvedValue({
    items: [],
    meta: {
      page: 1,
      pageSize: 24,
      totalItems: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    },
  });

  return {
    search,
    findBySlug: jest.fn(),
    findById: jest.fn(),
    listVariants: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    countActiveOrderReferences: jest.fn().mockResolvedValue(0),
    withTransaction: async (callback: (repo: any, tx: any) => Promise<unknown>) =>
      callback(
        {
          update: jest.fn().mockResolvedValue({}),
          softDelete: jest.fn(),
        },
        prisma,
      ),
  };
};

const createCategoryRepositoryStub = () =>
  ({
    getHierarchy: jest.fn<() => Promise<CategoryNode[]>>().mockResolvedValue([]),
    updateDescendantPaths: jest.fn(),
    getChildren: jest.fn().mockResolvedValue([]),
    getBreadcrumbs: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    findBySlug: jest.fn(),
  }) as unknown as any;

const createPrismaStub = () => ({
  review: {
    aggregate: jest
      .fn()
      .mockResolvedValue({ _avg: { rating: new Prisma.Decimal(4.5) }, _count: { rating: 10 } }),
    groupBy: jest.fn().mockResolvedValue([
      { rating: 5, _count: { rating: 6 } },
      { rating: 4, _count: { rating: 4 } },
    ]),
  },
  productVariant: {
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn(),
    updateMany: jest.fn(),
    update: jest.fn(),
    findFirst: jest.fn(),
    delete: jest.fn(),
  },
  productCategory: {
    groupBy: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  category: {
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
  },
  product: {
    findMany: jest.fn(),
  },
});

const PRODUCT_ID = "clprodaurora0000000000000";
const VARIANT_ID = "clvariantprime00000000000";
const CATEGORY_ID = "clcategoryroot00000000000";

const createProductEntity = () => {
  const timestamp = new Date("2025-01-01T10:00:00Z");
  return {
    id: PRODUCT_ID,
    title: "Aurora Desk Lamp",
    slug: "aurora-desk-lamp",
    summary: "Ambient lighting",
    description: null,
    status: "ACTIVE",
    price: new Prisma.Decimal(199),
    compareAtPrice: null,
    currency: "TRY",
    inventoryPolicy: "TRACK",
    searchKeywords: ["aurora"],
    attributes: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    variants: [
      {
        id: VARIANT_ID,
        productId: PRODUCT_ID,
        title: "Default",
        sku: "AURORA-1",
        price: new Prisma.Decimal(199),
        compareAtPrice: null,
        stock: 10,
        isPrimary: true,
        attributes: null,
        weightGrams: 2500,
        createdAt: timestamp,
        updatedAt: timestamp,
        variantMedia: [],
      },
    ],
    categories: [
      {
        productId: PRODUCT_ID,
        categoryId: CATEGORY_ID,
        isPrimary: true,
        assignedAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
        category: {
          id: CATEGORY_ID,
          name: "Lighting",
          slug: "lighting",
          description: null,
          parentId: null,
          level: 0,
          path: "/lighting",
          imageUrl: null,
          iconUrl: null,
          displayOrder: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      },
    ],
    productMedia: [],
  };
};

describe("CatalogService", () => {
  it("caches public product listings", async () => {
    const prisma = createPrismaStub();
    const productRepository = createProductRepositoryStub(prisma);
    const cache = createCatalogCacheStub();
    cache.invalidateCategoryTrees = jest.fn();

    const service = new CatalogService({
      productRepository: productRepository as unknown as any,
      categoryRepository: createCategoryRepositoryStub() as unknown as any,
      cache,
      prisma: prisma as unknown as any,
    });

    await service.listPublicProducts({});
    await service.listPublicProducts({});

    expect(productRepository.search).toHaveBeenCalledTimes(1);
    expect(cache.getCalls).toHaveBeenCalledTimes(2);
    expect(cache.setCalls).toHaveBeenCalledTimes(1);
  });

  it("rejects inactive products in detail view", async () => {
    const prisma = createPrismaStub();
    const productRepository = createProductRepositoryStub(prisma);
    productRepository.findBySlug.mockResolvedValue({
      id: "prod_1",
      slug: "demo",
      status: "DRAFT",
      deletedAt: null,
    });

    const service = new CatalogService({
      productRepository: productRepository as unknown as any,
      categoryRepository: createCategoryRepositoryStub() as unknown as any,
      cache: createCatalogCacheStub(),
      prisma: prisma as unknown as any,
    });

    await expect(service.getProductDetail("demo")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("assigns primary flag when adding the first variant", async () => {
    const prisma = createPrismaStub();
    const productRepository = createProductRepositoryStub(prisma);
    productRepository.findById.mockResolvedValue({
      id: "prod_1",
      slug: "demo",
      price: new Prisma.Decimal(100),
      currency: "TRY",
      variants: [],
      attributes: null,
      deletedAt: null,
    });

    prisma.productVariant.create.mockResolvedValue({
      id: "variant_1",
      title: "Default",
      sku: "demo-1",
      price: new Prisma.Decimal(120),
      compareAtPrice: null,
      stock: 5,
      isPrimary: true,
      attributes: null,
      variantMedia: [],
    });

    const service = new CatalogService({
      productRepository: productRepository as unknown as any,
      categoryRepository: createCategoryRepositoryStub() as unknown as any,
      cache: createCatalogCacheStub(),
      prisma: prisma as unknown as any,
    });

    const variant = await service.addVariant("prod_1", {
      title: "Default",
      price: { amount: "120", currency: "TRY" },
      stock: 5,
    });

    expect(variant.isPrimary).toBe(true);
    expect(prisma.productVariant.updateMany).not.toHaveBeenCalled();
  });

  it("prevents archiving products with active orders", async () => {
    const prisma = createPrismaStub();
    const productRepository = createProductRepositoryStub(prisma);
    productRepository.findById.mockResolvedValue({
      id: PRODUCT_ID,
      deletedAt: null,
    });
    productRepository.countActiveOrderReferences.mockResolvedValue(2);

    const service = new CatalogService({
      productRepository: productRepository as unknown as any,
      categoryRepository: createCategoryRepositoryStub() as unknown as any,
      cache: createCatalogCacheStub(),
      prisma: prisma as unknown as any,
    });

    await expect(service.archiveProduct(PRODUCT_ID)).rejects.toBeInstanceOf(ConflictError);
    expect(productRepository.countActiveOrderReferences).toHaveBeenCalledWith(PRODUCT_ID);
  });

  it("archives products and clears variants when there are no active orders", async () => {
    const prisma = createPrismaStub();
    const productRepository = createProductRepositoryStub(prisma);
    productRepository.findById.mockResolvedValue({
      id: PRODUCT_ID,
      deletedAt: null,
    });

    const updateMock = jest.fn().mockResolvedValue(undefined);
    const softDeleteMock = jest.fn().mockResolvedValue(undefined);
    productRepository.withTransaction = jest.fn(async (handler) =>
      handler(
        {
          update: updateMock,
          softDelete: softDeleteMock,
        },
        prisma,
      ),
    );

    const cache = {
      invalidateProductLists: jest.fn().mockResolvedValue(undefined),
      invalidateCategoryTrees: jest.fn().mockResolvedValue(undefined),
    };

    const service = new CatalogService({
      productRepository: productRepository as unknown as any,
      categoryRepository: createCategoryRepositoryStub() as unknown as any,
      cache: cache as unknown as any,
      prisma: prisma as unknown as any,
    });

    await service.archiveProduct(PRODUCT_ID);

    expect(productRepository.withTransaction).toHaveBeenCalled();
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: PRODUCT_ID },
      data: {
        status: "ARCHIVED",
        inventoryPolicy: "DENY",
      },
    });
    expect(softDeleteMock).toHaveBeenCalledWith(PRODUCT_ID);
    expect(prisma.productVariant.updateMany).toHaveBeenCalledWith({
      where: { productId: PRODUCT_ID },
      data: { stock: 0 },
    });
    expect(cache.invalidateProductLists).toHaveBeenCalled();
    expect(cache.invalidateCategoryTrees).toHaveBeenCalled();
  });

  it("rejects variant updates with negative stock values", async () => {
    const prisma = createPrismaStub();
    prisma.productVariant.findUnique.mockResolvedValue({
      id: VARIANT_ID,
      productId: PRODUCT_ID,
      sku: "AURORA-1",
      title: "Default",
      price: new Prisma.Decimal(199),
      compareAtPrice: null,
      stock: 5,
      isPrimary: true,
      attributes: null,
      variantMedia: [],
      product: {
        id: PRODUCT_ID,
        slug: "aurora-desk-lamp",
        price: new Prisma.Decimal(199),
        currency: "TRY",
        deletedAt: null,
      },
    });

    const service = new CatalogService({
      productRepository: createProductRepositoryStub(prisma) as unknown as any,
      categoryRepository: createCategoryRepositoryStub() as unknown as any,
      cache: createCatalogCacheStub(),
      prisma: prisma as unknown as any,
    });

    await expect(
      service.updateVariant(PRODUCT_ID, VARIANT_ID, {
        stock: -1,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("reassigns primary variant when current primary is unset", async () => {
    const prisma = createPrismaStub();
    const replacementVariant = { id: "clreplacement000000000000", isPrimary: false };
    prisma.productVariant.findUnique.mockResolvedValue({
      id: VARIANT_ID,
      productId: PRODUCT_ID,
      sku: "AURORA-1",
      title: "Default",
      price: new Prisma.Decimal(199),
      compareAtPrice: null,
      stock: 6,
      isPrimary: true,
      attributes: null,
      variantMedia: [],
      product: {
        id: PRODUCT_ID,
        slug: "aurora-desk-lamp",
        price: new Prisma.Decimal(199),
        currency: "TRY",
        deletedAt: null,
      },
    });
    prisma.productVariant.findFirst.mockResolvedValue(replacementVariant);

    const updatedVariantRecord = {
      id: VARIANT_ID,
      productId: PRODUCT_ID,
      title: "Default",
      sku: "AURORA-1",
      price: new Prisma.Decimal(199),
      compareAtPrice: null,
      stock: 4,
      isPrimary: false,
      attributes: null,
      weightGrams: null,
      variantMedia: [],
    };

    prisma.productVariant.update.mockResolvedValue(updatedVariantRecord);
    const productRepository = createProductRepositoryStub(prisma);
    productRepository.withTransaction = jest.fn(async (handler) => handler({}, prisma));

    const service = new CatalogService({
      productRepository: productRepository as unknown as any,
      categoryRepository: createCategoryRepositoryStub() as unknown as any,
      cache: createCatalogCacheStub(),
      prisma: prisma as unknown as any,
    });

    const variant = await service.updateVariant(PRODUCT_ID, VARIANT_ID, {
      stock: 4,
      isPrimary: false,
    });

    expect(prisma.productVariant.update).toHaveBeenCalledWith({
      where: { id: VARIANT_ID },
      data: expect.objectContaining({ stock: 4, isPrimary: false }),
      include: { variantMedia: { include: { media: true } } },
    });
    expect(prisma.productVariant.findFirst).toHaveBeenCalledWith({
      where: { productId: PRODUCT_ID, id: { not: VARIANT_ID } },
      orderBy: { createdAt: "asc" },
    });
    expect(prisma.productVariant.update).toHaveBeenCalledWith({
      where: { id: replacementVariant.id },
      data: { isPrimary: true },
    });
    expect(variant.isPrimary).toBe(false);
  });

  it("promotes new variant to primary when existing variants are non-primary", async () => {
    const prisma = createPrismaStub();
    const productRepository = createProductRepositoryStub(prisma);
    productRepository.findById.mockResolvedValue({
      id: PRODUCT_ID,
      slug: "aurora-desk-lamp",
      price: new Prisma.Decimal(199),
      currency: "TRY",
      attributes: null,
      deletedAt: null,
      variants: [
        { id: "variant-1", isPrimary: false },
        { id: "variant-2", isPrimary: false },
      ],
    });

    prisma.productVariant.create.mockResolvedValue({
      id: VARIANT_ID,
      title: "Large",
      sku: "aurora-desk-lamp-3",
      price: new Prisma.Decimal(220),
      compareAtPrice: null,
      stock: 0,
      isPrimary: true,
      attributes: null,
      variantMedia: [],
    });

    const service = new CatalogService({
      productRepository: productRepository as unknown as any,
      categoryRepository: createCategoryRepositoryStub() as unknown as any,
      cache: createCatalogCacheStub(),
      prisma: prisma as unknown as any,
    });

    const variant = await service.addVariant(PRODUCT_ID, {
      title: "Large",
      price: { amount: "220", currency: "TRY" },
    });

    expect(variant.isPrimary).toBe(true);
    expect(prisma.productVariant.updateMany).toHaveBeenCalledWith({
      where: { productId: PRODUCT_ID, id: { not: VARIANT_ID } },
      data: { isPrimary: false },
    });
  });

  it("deletes non-primary variants and invalidates product cache", async () => {
    const prisma = createPrismaStub();
    prisma.productVariant.findUnique.mockResolvedValue({
      id: VARIANT_ID,
      productId: PRODUCT_ID,
      isPrimary: false,
      product: {
        deletedAt: null,
      },
    });

    const cache = createCatalogCacheStub();
    const service = new CatalogService({
      productRepository: createProductRepositoryStub(prisma) as unknown as any,
      categoryRepository: createCategoryRepositoryStub() as unknown as any,
      cache,
      prisma: prisma as unknown as any,
    });

    await service.deleteVariant(PRODUCT_ID, VARIANT_ID);

    expect(prisma.productVariant.delete).toHaveBeenCalledWith({ where: { id: VARIANT_ID } });
    expect(cache.getCalls).not.toHaveBeenCalled();
  });

  it("creates products with generated slug and default status", async () => {
    const prisma = createPrismaStub();
    const productRepository = createProductRepositoryStub(prisma);
    const createdProduct = createProductEntity();
    productRepository.create.mockResolvedValue(createdProduct);

    const cache = {
      invalidateProductLists: jest.fn().mockResolvedValue(undefined),
      invalidateCategoryTrees: jest.fn().mockResolvedValue(undefined),
    };

    const service = new CatalogService({
      productRepository: productRepository as unknown as any,
      categoryRepository: createCategoryRepositoryStub() as unknown as any,
      cache: cache as unknown as any,
      prisma: prisma as unknown as any,
    });

    const result = await service.createProduct({
      title: "Aurora Desk Lamp",
      price: { amount: "199", currency: "TRY" },
      variants: [
        {
          title: "Default",
          price: { amount: "199", currency: "TRY" },
          stock: 5,
        },
      ],
      categoryIds: [CATEGORY_ID],
    });

    expect(productRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: "Aurora Desk Lamp",
          slug: "aurora-desk-lamp",
          status: "DRAFT",
          variants: expect.objectContaining({
            create: expect.arrayContaining([
              expect.objectContaining({
                isPrimary: true,
                sku: expect.stringContaining("aurora-desk-lamp"),
              }),
            ]),
          }),
        }),
      }),
    );
    expect(cache.invalidateProductLists).toHaveBeenCalled();
    expect(cache.invalidateCategoryTrees).toHaveBeenCalled();
    expect(result.slug).toBe("aurora-desk-lamp");
    expect(result.variants[0]?.isPrimary).toBe(true);
  });

  it("appends suffix when requested product slug already exists", async () => {
    const prisma = createPrismaStub();
    const productRepository = createProductRepositoryStub(prisma);
    const createdProduct = createProductEntity();

    productRepository.findBySlug
      .mockResolvedValueOnce({ id: "existing-product" })
      .mockResolvedValueOnce(null);
    productRepository.create.mockResolvedValue(createdProduct);

    const service = new CatalogService({
      productRepository: productRepository as unknown as any,
      categoryRepository: createCategoryRepositoryStub() as unknown as any,
      cache: {
        invalidateProductLists: jest.fn(),
        invalidateCategoryTrees: jest.fn(),
      } as unknown as any,
      prisma: prisma as unknown as any,
    });

    await service.createProduct({
      title: "Aurora Desk Lamp",
      slug: "aurora-desk-lamp",
      price: { amount: "199", currency: "TRY" },
      variants: [
        {
          title: "Default",
          price: { amount: "199", currency: "TRY" },
          stock: 4,
        },
      ],
      categoryIds: [CATEGORY_ID],
    });

    expect(productRepository.findBySlug).toHaveBeenNthCalledWith(1, "aurora-desk-lamp", {
      select: { id: true },
    });
    expect(productRepository.findBySlug).toHaveBeenNthCalledWith(2, "aurora-desk-lamp-1", {
      select: { id: true },
    });
    expect(productRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          slug: "aurora-desk-lamp-1",
        }),
      }),
    );
  });

  it("updates products and rewrites category assignments", async () => {
    const prisma = createPrismaStub();
    const productRepository = createProductRepositoryStub(prisma);
    const existingProduct = createProductEntity();
    const updatedProduct = {
      ...createProductEntity(),
      title: "Aurora Desk Lamp Limited",
      slug: "aurora-desk-lamp-limited",
      searchKeywords: ["aurora", "limited"],
      updatedAt: new Date("2025-02-01T00:00:00Z"),
    };

    productRepository.findById
      .mockResolvedValueOnce(existingProduct)
      .mockResolvedValueOnce(updatedProduct);

    const updateMock = jest.fn().mockResolvedValue(updatedProduct);
    productRepository.withTransaction = jest.fn(async (handler) =>
      handler(
        {
          update: updateMock,
        },
        prisma,
      ),
    );

    const cache = {
      invalidateProductLists: jest.fn().mockResolvedValue(undefined),
      invalidateCategoryTrees: jest.fn().mockResolvedValue(undefined),
    };

    const service = new CatalogService({
      productRepository: productRepository as unknown as any,
      categoryRepository: createCategoryRepositoryStub() as unknown as any,
      cache: cache as unknown as any,
      prisma: prisma as unknown as any,
    });

    const result = await service.updateProduct(PRODUCT_ID, {
      title: "Aurora Desk Lamp Limited",
      summary: "Refined finish",
      categoryIds: [CATEGORY_ID],
    });

    expect(productRepository.findById).toHaveBeenCalledTimes(2);
    expect(productRepository.withTransaction).toHaveBeenCalled();
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: PRODUCT_ID },
        data: expect.objectContaining({
          title: "Aurora Desk Lamp Limited",
          slug: "aurora-desk-lamp-limited",
          summary: "Refined finish",
        }),
      }),
    );
    expect(prisma.productCategory.deleteMany).toHaveBeenCalledWith({
      where: { productId: PRODUCT_ID },
    });
    expect(prisma.productCategory.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            productId: PRODUCT_ID,
            categoryId: CATEGORY_ID,
            isPrimary: true,
          }),
        ],
      }),
    );
    expect(cache.invalidateProductLists).toHaveBeenCalled();
    expect(cache.invalidateCategoryTrees).toHaveBeenCalled();
    expect(result.title).toBe("Aurora Desk Lamp Limited");
    expect(result.slug).toBe("aurora-desk-lamp-limited");
  });

  it("prevents assigning a category as its own descendant", async () => {
    const prisma = createPrismaStub();
    prisma.category.findUnique.mockImplementation(({ where: { id } }) => {
      if (id === "cat-1") {
        return {
          id: "cat-1",
          name: "Lighting",
          slug: "lighting",
          description: null,
          parentId: null,
          level: 0,
          path: "/lighting",
          imageUrl: null,
          iconUrl: null,
          displayOrder: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }

      return {
        id: "cat-2",
        name: "Desk Lamps",
        slug: "desk-lamps",
        description: null,
        parentId: "cat-1",
        level: 1,
        path: "/lighting/desk-lamps",
        imageUrl: null,
        iconUrl: null,
        displayOrder: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });

    const service = new CatalogService({
      productRepository: createProductRepositoryStub(prisma) as unknown as any,
      categoryRepository: createCategoryRepositoryStub() as unknown as any,
      cache: createCatalogCacheStub(),
      prisma: prisma as unknown as any,
    });

    await expect(
      service.updateCategory("cat-1", {
        parentId: "cat-2",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("merges top-level filters and resolves category slug before search", async () => {
    const prisma = createPrismaStub();
    const productRepository = createProductRepositoryStub(prisma);
    const cache = createCatalogCacheStub();
    const categoryRepository = createCategoryRepositoryStub();
    const category = {
      id: CATEGORY_ID,
      name: "Lighting",
      slug: "lighting",
      description: null,
      parentId: null,
      level: 0,
      path: "/lighting",
      imageUrl: null,
      iconUrl: null,
      displayOrder: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    categoryRepository.findBySlug.mockResolvedValue(category);

    const service = new CatalogService({
      productRepository: productRepository as unknown as any,
      categoryRepository,
      cache,
      prisma: prisma as unknown as any,
    });

    await service.listPublicProducts({
      categorySlug: "lighting",
      priceMin: "50",
      sort: "price_desc",
      page: "2",
      perPage: "12",
    });

    expect(categoryRepository.findBySlug).toHaveBeenCalledWith("lighting");
    expect(productRepository.search).toHaveBeenCalledTimes(1);

    const [filters, pagination] = productRepository.search.mock.calls[0] ?? [];

    expect(filters).toMatchObject({
      statuses: ["ACTIVE"],
      minPrice: expect.any(Prisma.Decimal),
    });
    expect(filters?.categoryIds).toContain(category.id);
    expect(Number(pagination?.page)).toBe(2);
    expect(Number(pagination?.pageSize)).toBe(12);
  });

  it("returns empty results without querying repository when category slug is unknown", async () => {
    const prisma = createPrismaStub();
    const productRepository = createProductRepositoryStub(prisma);
    const cache = createCatalogCacheStub();
    const categoryRepository = createCategoryRepositoryStub();
    categoryRepository.findBySlug.mockResolvedValue(null);

    const service = new CatalogService({
      productRepository: productRepository as unknown as any,
      categoryRepository,
      cache,
      prisma: prisma as unknown as any,
    });

    const result = await service.listPublicProducts({
      categorySlug: "missing-category",
      page: 3,
      perPage: 12,
    });

    expect(result.items).toHaveLength(0);
    expect(result.meta.page).toBe(3);
    expect(result.meta.pageSize).toBe(12);
    expect(result.meta.totalItems).toBe(0);
    expect(productRepository.search).not.toHaveBeenCalled();
  });

  it("returns active product detail together with review summary", async () => {
    const prisma = createPrismaStub();
    const productRepository = createProductRepositoryStub(prisma);
    const product = createProductEntity();
    productRepository.findBySlug.mockResolvedValue(product);

    const service = new CatalogService({
      productRepository: productRepository as unknown as any,
      categoryRepository: createCategoryRepositoryStub() as unknown as any,
      cache: createCatalogCacheStub(),
      prisma: prisma as unknown as any,
    });

    const result = await service.getProductDetail(product.slug);

    expect(result.product.slug).toBe(product.slug);
    expect(result.reviewSummary.averageRating).toBe(4.5);
    expect(prisma.review.aggregate).toHaveBeenCalled();
  });

  it("filters out-of-stock variants when requested", async () => {
    const prisma = createPrismaStub();
    const productRepository = createProductRepositoryStub(prisma);
    productRepository.findById.mockResolvedValue({
      id: PRODUCT_ID,
      deletedAt: null,
      price: new Prisma.Decimal(199),
      currency: "TRY",
    });
    productRepository.listVariants.mockResolvedValue([
      {
        id: VARIANT_ID,
        title: "Default",
        sku: "AURORA-1",
        price: new Prisma.Decimal(199),
        compareAtPrice: null,
        stock: 3,
        isPrimary: true,
        attributes: null,
        variantMedia: [],
      },
    ]);

    const service = new CatalogService({
      productRepository: productRepository as unknown as any,
      categoryRepository: createCategoryRepositoryStub() as unknown as any,
      cache: createCatalogCacheStub(),
      prisma: prisma as unknown as any,
    });

    const variants = await service.listProductVariants(PRODUCT_ID, {
      includeOutOfStock: false,
    });

    expect(productRepository.listVariants).toHaveBeenCalledWith(PRODUCT_ID, {
      includeOutOfStock: false,
    });
    expect(variants[0]?.availability).toBe("low_stock");
  });

  it("prevents deletion of primary variants", async () => {
    const prisma = createPrismaStub();
    prisma.productVariant.findUnique.mockResolvedValue({
      id: VARIANT_ID,
      productId: PRODUCT_ID,
      isPrimary: true,
      product: {
        deletedAt: null,
      },
    });

    const service = new CatalogService({
      productRepository: createProductRepositoryStub(prisma) as unknown as any,
      categoryRepository: createCategoryRepositoryStub() as unknown as any,
      cache: createCatalogCacheStub(),
      prisma: prisma as unknown as any,
    });

    await expect(service.deleteVariant(PRODUCT_ID, VARIANT_ID)).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it("caches category hierarchy results", async () => {
    const prisma = createPrismaStub();
    const cache = createCatalogCacheStub();

    const categoryRepository = createCategoryRepositoryStub();
    categoryRepository.getHierarchy.mockResolvedValue([
      {
        id: CATEGORY_ID,
        name: "Lighting",
        slug: "lighting",
        description: null,
        parentId: null,
        level: 0,
        path: "/lighting",
        imageUrl: null,
        iconUrl: null,
        displayOrder: null,
        createdAt: new Date("2024-01-01T00:00:00Z"),
        updatedAt: new Date("2024-01-01T00:00:00Z"),
        children: [],
      },
    ]);

    const service = new CatalogService({
      productRepository: createProductRepositoryStub(prisma) as unknown as any,
      categoryRepository,
      cache,
      prisma: prisma as unknown as any,
    });

    const first = await service.listCategories();
    const second = await service.listCategories();

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
    expect(categoryRepository.getHierarchy).toHaveBeenCalledTimes(1);
    expect(cache.categoryGetCalls).toHaveBeenCalledTimes(2);
  });

  it("forces category cache refresh when requested", async () => {
    const prisma = createPrismaStub();
    const cache = createCatalogCacheStub();
    cache.invalidateCategoryTrees = jest.fn();

    const categoryRepository = createCategoryRepositoryStub();
    categoryRepository.getHierarchy.mockResolvedValue([
      {
        id: CATEGORY_ID,
        name: "Lighting",
        slug: "lighting",
        description: null,
        parentId: null,
        level: 0,
        path: "/lighting",
        imageUrl: null,
        iconUrl: null,
        displayOrder: null,
        createdAt: new Date("2024-01-01T00:00:00Z"),
        updatedAt: new Date("2024-01-01T00:00:00Z"),
        children: [],
      },
    ]);

    const service = new CatalogService({
      productRepository: createProductRepositoryStub(prisma) as unknown as any,
      categoryRepository,
      cache,
      prisma: prisma as unknown as any,
    });

    await service.listCategories({ depth: 2, refresh: true });

    expect(cache.categoryGetCalls).not.toHaveBeenCalled();
    expect(cache.categorySetCalls).toHaveBeenCalledTimes(1);
  });

  it("creates categories with parent linkage", async () => {
    const prisma = createPrismaStub();
    const cache = createCatalogCacheStub();
    cache.invalidateCategoryTrees = jest.fn();
    const parentCategory = {
      id: CATEGORY_ID,
      name: "Lighting",
      slug: "lighting",
      description: null,
      parentId: null,
      level: 0,
      path: "/lighting",
      imageUrl: null,
      iconUrl: null,
      displayOrder: null,
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-01-01T00:00:00Z"),
    };
    prisma.category.findUnique.mockResolvedValueOnce(parentCategory);

    const categoryRepository = createCategoryRepositoryStub();
    categoryRepository.create.mockResolvedValue({
      ...parentCategory,
      id: "clchildcategory00000000000",
      name: "Desk Lamps",
      slug: "desk-lamps",
      parentId: CATEGORY_ID,
      level: 1,
      path: "/lighting/desk-lamps",
      createdAt: new Date("2024-02-01T00:00:00Z"),
      updatedAt: new Date("2024-02-01T00:00:00Z"),
    });

    const service = new CatalogService({
      productRepository: createProductRepositoryStub(prisma) as unknown as any,
      categoryRepository: categoryRepository as unknown as any,
      cache,
      prisma: prisma as unknown as any,
    });

    const result = await service.createCategory({
      name: "Desk Lamps",
      parentId: CATEGORY_ID,
    });

    expect(prisma.category.findUnique).toHaveBeenCalledWith({ where: { id: CATEGORY_ID } });
    expect(categoryRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          level: 1,
          path: "/lighting/desk-lamps",
        }),
      }),
    );
    expect(cache.invalidateCategoryTrees).toHaveBeenCalledTimes(1);
    expect(result.parentId).toBe(CATEGORY_ID);
  });

  it("prevents deleting categories with active products", async () => {
    const prisma = createPrismaStub();
    prisma.category.findUnique.mockResolvedValue({
      id: CATEGORY_ID,
      name: "Lighting",
      slug: "lighting",
      description: null,
      parentId: null,
      level: 0,
      path: "/lighting",
      imageUrl: null,
      iconUrl: null,
      displayOrder: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prisma.category.count.mockResolvedValueOnce(0);
    prisma.productCategory.count.mockResolvedValueOnce(2);

    const service = new CatalogService({
      productRepository: createProductRepositoryStub(prisma) as unknown as any,
      categoryRepository: createCategoryRepositoryStub() as unknown as any,
      cache: createCatalogCacheStub(),
      prisma: prisma as unknown as any,
    });

    await expect(service.deleteCategory(CATEGORY_ID)).rejects.toBeInstanceOf(ConflictError);
    expect(prisma.productCategory.count).toHaveBeenCalledWith({
      where: {
        categoryId: CATEGORY_ID,
        product: {
          status: "ACTIVE",
          deletedAt: null,
        },
      },
    });
  });

  it("deletes categories when no dependents exist", async () => {
    const prisma = createPrismaStub();
    prisma.category.findUnique.mockResolvedValue({
      id: CATEGORY_ID,
      name: "Lighting",
      slug: "lighting",
      description: null,
      parentId: null,
      level: 0,
      path: "/lighting",
      imageUrl: null,
      iconUrl: null,
      displayOrder: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prisma.category.count.mockResolvedValueOnce(0);
    prisma.productCategory.count.mockResolvedValueOnce(0);

    const cache = createCatalogCacheStub();

    const service = new CatalogService({
      productRepository: createProductRepositoryStub(prisma) as unknown as any,
      categoryRepository: createCategoryRepositoryStub() as unknown as any,
      cache,
      prisma: prisma as unknown as any,
    });

    await service.deleteCategory(CATEGORY_ID);

    expect(prisma.category.delete).toHaveBeenCalledWith({ where: { id: CATEGORY_ID } });
    expect(cache.categorySetCalls).toHaveBeenCalledTimes(0);
  });
});
