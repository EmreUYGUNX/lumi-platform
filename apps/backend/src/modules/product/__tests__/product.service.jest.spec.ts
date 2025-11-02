/* eslint-disable import/order */
import { describe, expect, it, jest } from "@jest/globals";
import { Prisma, ProductStatus } from "@prisma/client";

import { NotFoundError, ValidationError } from "@/lib/errors.js";
import type { PaginatedResult } from "@/lib/repository/base.repository.js";
import type { ProductWithRelations } from "@lumi/shared/dto";

import type { ProductSearchFilters } from "../product.repository.js";
import { ProductService } from "../product.service.js";

/* eslint-disable unicorn/no-null */

type RepositoryFindBySlug = (
  slug: string,
  options?: {
    include?: Prisma.ProductInclude;
    select?: Prisma.ProductSelect;
  },
) => Promise<ProductWithRelations | null>;

type RepositorySearch = (
  filters: ProductSearchFilters,
  pagination?: unknown,
) => Promise<PaginatedResult<ProductWithRelations>>;

const createRepository = (overrides: Partial<Record<string, unknown>> = {}) => {
  const listForRatingSort = jest
    .fn<(filters: ProductSearchFilters) => Promise<{ id: string; createdAt: Date }[]>>()
    .mockResolvedValue([]);
  const findWithRelations = jest
    .fn<(ids: string[]) => Promise<ProductWithRelations[]>>()
    .mockResolvedValue([]);
  const getAggregates = jest
    .fn<(ids: string[]) => Promise<Map<string, { average: number; count: number }>>>()
    .mockResolvedValue(new Map());

  return {
    findBySlug: jest.fn<RepositoryFindBySlug>(),
    search: jest.fn<RepositorySearch>(),
    listForRatingSort,
    findWithRelations,
    getReviewAggregates: getAggregates,
    ...overrides,
  };
};

const createProductEntity = (): ProductWithRelations => {
  const timestamp = new Date("2024-01-01T00:00:00.000Z");

  return {
    id: "ckproduct0000000000000000",
    title: "Aurora Desk Lamp",
    slug: "aurora-desk-lamp",
    sku: null,
    summary: "Ambient lighting for workspaces",
    description: null,
    status: "ACTIVE" as const,
    price: new Prisma.Decimal("249.90"),
    compareAtPrice: null,
    currency: "TRY",
    inventoryPolicy: "TRACK" as const,
    searchKeywords: ["lamp"],
    attributes: { colour: "black" },
    deletedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    variants: [
      {
        id: "ckvariant0000000000000000",
        productId: "ckproduct0000000000000000",
        title: "Default",
        sku: "LAMP-001",
        price: new Prisma.Decimal("249.90"),
        compareAtPrice: null,
        stock: 12,
        attributes: null,
        weightGrams: 3500,
        isPrimary: true,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    categories: [
      {
        productId: "ckproduct0000000000000000",
        categoryId: "ckcategory000000000000000",
        isPrimary: true,
        assignedAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
        category: {
          id: "ckcategory000000000000000",
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
    productMedia: [
      {
        productId: "ckproduct0000000000000000",
        mediaId: "ckmedia000000000000000000",
        sortOrder: 1,
        isPrimary: true,
        assignedAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
        media: {
          id: "ckmedia000000000000000000",
          assetId: "aurora.png",
          url: "https://cdn.example.com/aurora.png",
          type: "IMAGE" as const,
          provider: "CLOUDINARY" as const,
          mimeType: "image/png",
          sizeBytes: 120_000,
          width: 1200,
          height: 800,
          alt: "Aurora desk lamp",
          caption: "Aurora lamp on desk",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      },
    ],
  } as ProductWithRelations;
};

describe("ProductService", () => {
  it("normalises search queries and maps repository results to DTOs", async () => {
    const product = createProductEntity();
    const searchMock = jest.fn<RepositorySearch>().mockResolvedValue({
      items: [product],
      meta: {
        page: 1,
        pageSize: 25,
        totalItems: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    });

    const repository = createRepository({ search: searchMock });
    const service = new ProductService(repository as never);

    const result = await service.search({ search: "Aurora", page: "1", pageSize: "25" });

    expect(searchMock).toHaveBeenCalledTimes(1);
    expect(searchMock.mock.calls[0]?.[0]).toMatchObject({ term: "Aurora" });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.title).toBe("Aurora Desk Lamp");
    expect(result.meta.totalItems).toBe(1);
  });

  it("throws NotFoundError when product cannot be located", async () => {
    const repository = createRepository({
      findBySlug: jest.fn<RepositoryFindBySlug>().mockResolvedValue(null),
    });
    const service = new ProductService(repository as never);

    await expect(service.getBySlug("missing-product")).rejects.toThrow(NotFoundError);
  });

  it("returns mapped DTO when product is found", async () => {
    const product = createProductEntity();
    const repository = createRepository({
      findBySlug: jest.fn<RepositoryFindBySlug>().mockResolvedValue(product),
    });
    const service = new ProductService(repository as never);

    const dto = await service.getBySlug(product.slug);
    expect(dto.id).toBe(product.id);
    expect(dto.variants[0]?.isPrimary).toBe(true);
  });

  it("maps structured filter and pagination input to repository queries", async () => {
    const product = createProductEntity();
    const searchMock = jest.fn<RepositorySearch>().mockResolvedValue({
      items: [product],
      meta: {
        page: 2,
        pageSize: 10,
        totalItems: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: true,
      },
    });

    const repository = createRepository({ search: searchMock });
    const service = new ProductService(repository as never);

    await service.search({
      filter: {
        search: "Aurora lights",
        statuses: [ProductStatus.ACTIVE, ProductStatus.DRAFT],
        categoryIds: ["ckcategory000000000000000000"],
        primaryCategoryId: "ckcategory000000000000000999",
        collectionIds: ["ckcollection000000000000000000"],
        priceRange: { min: "199.99", max: "349.50" },
        includeDeleted: true,
        sort: "price_desc",
      },
      pagination: { page: 2, pageSize: 10 },
    });

    const [filters, options] = searchMock.mock.calls.at(-1) ?? [];
    expect(filters).toMatchObject({
      term: "Aurora lights",
      statuses: [ProductStatus.ACTIVE, ProductStatus.DRAFT],
      categoryIds: ["ckcategory000000000000000000"],
      primaryCategoryId: "ckcategory000000000000000999",
      collectionIds: ["ckcollection000000000000000000"],
      includeDeleted: true,
    });
    expect(filters?.minPrice).toBeInstanceOf(Prisma.Decimal);
    expect(filters?.maxPrice).toBeInstanceOf(Prisma.Decimal);
    expect(options).toMatchObject({
      page: 2,
      pageSize: 10,
      orderBy: [{ price: "desc" }],
      include: expect.any(Object),
    });
  });

  it("derives filters and pagination from raw query parameters", async () => {
    const product = createProductEntity();
    const searchMock = jest.fn<RepositorySearch>().mockResolvedValue({
      items: [product],
      meta: {
        page: 3,
        pageSize: 15,
        totalItems: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: true,
      },
    });

    const repository = createRepository({ search: searchMock });
    const service = new ProductService(repository as never);

    await service.search({
      search: "  orbit desk ",
      status: "active, draft ",
      categoryIds: "ckcategory100000000000000001, ckcategory200000000000000002",
      primaryCategoryId: "  ckcategory300000000000000003  ",
      collectionIds: ["ckcollection000000000000000001", "ckcollection000000000000000002"],
      priceMin: "100.5",
      priceMax: 150,
      includeDeleted: "false",
      inventoryAvailability: "in_stock",
      sort: "title_asc",
      page: "3",
      pageSize: "15",
    });

    const [filters, options] = searchMock.mock.calls.at(-1) ?? [];
    expect(filters).toMatchObject({
      term: "orbit desk",
      statuses: ["ACTIVE", "DRAFT"],
      categoryIds: ["ckcategory100000000000000001", "ckcategory200000000000000002"],
      primaryCategoryId: "ckcategory300000000000000003",
      collectionIds: ["ckcollection000000000000000001", "ckcollection000000000000000002"],
      includeDeleted: false,
    });
    expect(filters?.minPrice).toBeDefined();
    expect(filters?.maxPrice).toBeDefined();
    expect(Number(filters?.minPrice)).toBeCloseTo(100.5);
    expect(Number(filters?.maxPrice)).toBeCloseTo(150);
    expect(options).toMatchObject({
      page: 3,
      pageSize: 15,
      orderBy: [{ title: "asc" }],
    });
  });

  it("orders products by average rating when sort=rating", async () => {
    const firstProduct = createProductEntity();
    const secondTemplate = createProductEntity();
    const secondProduct: ProductWithRelations = {
      ...secondTemplate,
      id: "ckproduct1111111111111111",
      title: "Lumen Desk Lamp",
      slug: "lumen-desk-lamp",
      createdAt: new Date("2024-01-02T00:00:00.000Z"),
      updatedAt: new Date("2024-01-02T00:00:00.000Z"),
      variants: secondTemplate.variants.map((variant, index) => ({
        ...variant,
        id: `ckvariant111111111111111${index}`,
        productId: "ckproduct1111111111111111",
      })),
      categories: secondTemplate.categories.map((category) => ({
        ...category,
        productId: "ckproduct1111111111111111",
      })),
      productMedia: secondTemplate.productMedia.map((media) => ({
        ...media,
        productId: "ckproduct1111111111111111",
      })),
    };

    const candidates = [
      { id: firstProduct.id, createdAt: firstProduct.createdAt },
      { id: secondProduct.id, createdAt: secondProduct.createdAt },
    ];

    const listForRatingSortMock = jest
      .fn<(filters: ProductSearchFilters) => Promise<{ id: string; createdAt: Date }[]>>()
      .mockResolvedValue(candidates);

    const findWithRelationsMock = jest
      .fn<(ids: string[]) => Promise<ProductWithRelations[]>>()
      .mockResolvedValue([firstProduct, secondProduct] as ProductWithRelations[]);

    const getReviewAggregatesMock = jest
      .fn<(ids: string[]) => Promise<Map<string, { average: number; count: number }>>>()
      .mockResolvedValue(
        new Map<string, { average: number; count: number }>([
          [firstProduct.id, { average: 4.5, count: 12 }],
          [secondProduct.id, { average: 4.8, count: 3 }],
        ]),
      );

    const repository = createRepository({
      listForRatingSort: listForRatingSortMock,
      findWithRelations: findWithRelationsMock,
      getReviewAggregates: getReviewAggregatesMock,
    });
    const service = new ProductService(repository as never);

    const result = await service.search({ sort: "rating" });

    expect(listForRatingSortMock).toHaveBeenCalled();
    expect(findWithRelationsMock).toHaveBeenCalledWith([secondProduct.id, firstProduct.id]);
    expect(getReviewAggregatesMock).toHaveBeenCalledWith(
      expect.arrayContaining([firstProduct.id, secondProduct.id]),
    );
    expect(result.items.map((item) => item.id)).toEqual([secondProduct.id, firstProduct.id]);
    expect(result.meta.totalItems).toBe(2);
    expect(result.meta.hasNextPage).toBe(false);
  });

  it("rejects cursor-based pagination parameters", async () => {
    const repository = createRepository();
    const service = new ProductService(repository as never);

    await expect(
      service.search({
        cursor: "opaque-id",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

/* eslint-enable unicorn/no-null */
