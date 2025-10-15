/* eslint-disable import/order */
import { describe, expect, it, jest } from "@jest/globals";
import { Prisma, ProductStatus } from "@prisma/client";

import type { ProductWithRelations } from "@lumi/shared/dto";

import { NotFoundError, ValidationError } from "@/lib/errors.js";
import type { PaginatedResult } from "@/lib/repository/base.repository.js";

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

    const service = new ProductService({
      findBySlug: jest.fn<RepositoryFindBySlug>(),
      search: searchMock,
    });

    const result = await service.search({ search: "Aurora", page: "1", pageSize: "25" });

    expect(searchMock).toHaveBeenCalledTimes(1);
    expect(searchMock.mock.calls[0]?.[0]).toMatchObject({ term: "Aurora" });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.title).toBe("Aurora Desk Lamp");
    expect(result.meta.totalItems).toBe(1);
  });

  it("throws NotFoundError when product cannot be located", async () => {
    const findBySlugMock = jest.fn<RepositoryFindBySlug>().mockResolvedValue(null);
    const service = new ProductService({
      findBySlug: findBySlugMock,
      search: jest.fn<RepositorySearch>(),
    });

    await expect(service.getBySlug("missing-product")).rejects.toThrow(NotFoundError);
  });

  it("returns mapped DTO when product is found", async () => {
    const product = createProductEntity();
    const findBySlugMock = jest.fn<RepositoryFindBySlug>().mockResolvedValue(product);
    const service = new ProductService({
      findBySlug: findBySlugMock,
      search: jest.fn<RepositorySearch>(),
    });

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

    const service = new ProductService({
      findBySlug: jest.fn<RepositoryFindBySlug>(),
      search: searchMock,
    });

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

    const service = new ProductService({
      findBySlug: jest.fn<RepositoryFindBySlug>(),
      search: searchMock,
    });

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

  it("rejects cursor-based pagination parameters", async () => {
    const service = new ProductService({
      findBySlug: jest.fn<RepositoryFindBySlug>(),
      search: jest.fn<RepositorySearch>(),
    });

    await expect(
      service.search({
        cursor: "opaque-id",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

/* eslint-enable unicorn/no-null */
