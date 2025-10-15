import { describe, expect, it, jest } from "@jest/globals";
import { Prisma } from "@prisma/client";

import { NotFoundError } from "@/lib/errors.js";
import type { PaginatedResult } from "@/lib/repository/base.repository.js";

import type { ProductSearchFilters } from "../product.repository.js";
import { ProductService } from "../product.service.js";

/* eslint-disable unicorn/no-null */

const createProductEntity = () => {
  const timestamp = new Date("2024-01-01T00:00:00.000Z");

  return {
    id: "prod_123",
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
        id: "variant_123",
        productId: "prod_123",
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
        productId: "prod_123",
        categoryId: "cat_123",
        isPrimary: true,
        assignedAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
        category: {
          id: "cat_123",
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
        productId: "prod_123",
        mediaId: "media_123",
        sortOrder: 1,
        isPrimary: true,
        assignedAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
        media: {
          id: "media_123",
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
    collections: [],
    reviews: [],
    orderItems: [],
  };
};

describe("ProductService", () => {
  it("normalises search queries and maps repository results to DTOs", async () => {
    const product = createProductEntity();
    const searchMock = jest
      .fn<Promise<PaginatedResult<typeof product>>, [ProductSearchFilters, unknown?]>()
      .mockResolvedValue({
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
      findBySlug: jest.fn(),
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
    const service = new ProductService({
      findBySlug: jest.fn().mockResolvedValue(null),
      search: jest.fn(),
    });

    await expect(service.getBySlug("missing-product")).rejects.toThrow(NotFoundError);
  });

  it("returns mapped DTO when product is found", async () => {
    const product = createProductEntity();
    const service = new ProductService({
      findBySlug: jest.fn().mockResolvedValue(product),
      search: jest.fn(),
    });

    const dto = await service.getBySlug(product.slug);
    expect(dto.id).toBe(product.id);
    expect(dto.variants[0]?.isPrimary).toBe(true);
  });
});

/* eslint-enable unicorn/no-null */
