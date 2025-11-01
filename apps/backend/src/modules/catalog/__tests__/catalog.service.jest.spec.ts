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
  },
  productCategory: {
    groupBy: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
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

const createProductEntity = () => {
  const timestamp = new Date("2025-01-01T10:00:00Z");
  return {
    id: "prod_aurora",
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
        id: "variant_primary",
        productId: "prod_aurora",
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
        productId: "prod_aurora",
        categoryId: "cat_lighting",
        isPrimary: true,
        assignedAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
        category: {
          id: "cat_lighting",
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
      id: "cat_lighting",
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
      id: "prod_aurora",
      deletedAt: null,
      price: new Prisma.Decimal(199),
      currency: "TRY",
    });
    productRepository.listVariants.mockResolvedValue([
      {
        id: "variant_primary",
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

    const variants = await service.listProductVariants("prod_aurora", {
      includeOutOfStock: false,
    });

    expect(productRepository.listVariants).toHaveBeenCalledWith("prod_aurora", {
      includeOutOfStock: false,
    });
    expect(variants[0]?.availability).toBe("in_stock");
  });

  it("prevents deletion of primary variants", async () => {
    const prisma = createPrismaStub();
    prisma.productVariant.findUnique.mockResolvedValue({
      id: "variant_primary",
      productId: "prod_aurora",
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

    await expect(service.deleteVariant("prod_aurora", "variant_primary")).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it("caches category hierarchy results", async () => {
    const prisma = createPrismaStub();
    const cache = createCatalogCacheStub();

    const categoryRepository = createCategoryRepositoryStub();
    categoryRepository.getHierarchy.mockResolvedValue([
      {
        id: "cat_root",
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
});
