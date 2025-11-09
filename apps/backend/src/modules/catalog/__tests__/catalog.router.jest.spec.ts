/* eslint-disable @typescript-eslint/ban-ts-comment, unicorn/no-null, prefer-destructuring */
// @ts-nocheck
import { describe, expect, it, jest } from "@jest/globals";
import request from "supertest";

import { createTestApp, withTestApp } from "@/testing/index.js";

import type { CatalogService } from "../catalog.service.js";

const buildProduct = () => ({
  id: "prod_1",
  title: "Aurora Lamp",
  slug: "aurora-lamp",
  summary: "Ambient lighting",
  description: null,
  status: "ACTIVE",
  price: { amount: "199.00", currency: "TRY" },
  compareAtPrice: undefined,
  currency: "TRY",
  inventoryPolicy: "TRACK",
  searchKeywords: ["lamp"],
  attributes: null,
  variants: [
    {
      id: "variant_1",
      title: "Default",
      sku: "VAR-1",
      price: { amount: "199.00", currency: "TRY" },
      compareAtPrice: undefined,
      stock: 12,
      attributes: null,
      weightGrams: 2500,
      isPrimary: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  categories: [],
  media: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  deletedAt: null,
});

const createCatalogServiceStub = () => {
  const product = buildProduct();

  const stub = {
    listPublicProducts: jest.fn().mockResolvedValue({
      items: [product],
      meta: {
        page: 1,
        pageSize: 24,
        totalItems: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    }),
    listPopularProducts: jest.fn().mockResolvedValue([product]),
    getProductDetail: jest.fn().mockResolvedValue({
      product,
      reviewSummary: {
        totalReviews: 0,
        averageRating: 0,
        ratingBreakdown: {},
      },
    }),
    listProductVariants: jest.fn(),
    createProduct: jest.fn(),
    updateProduct: jest.fn(),
    archiveProduct: jest.fn(),
    addVariant: jest.fn(),
    updateVariant: jest.fn(),
    deleteVariant: jest.fn(),
    listCategories: jest.fn().mockResolvedValue([]),
    getCategoryDetail: jest.fn(),
    createCategory: jest.fn(),
    updateCategory: jest.fn(),
    deleteCategory: jest.fn(),
  };

  return { stub, product };
};

const appOptionsWithService = (service: CatalogService) => ({
  apiOptions: {
    catalogOptions: {
      service,
    },
  },
  configOverrides: {
    cache: {
      redisUrl: "",
    },
  },
});

describe("catalog router", () => {
  it("returns public product listings through the API", async () => {
    const { stub, product } = createCatalogServiceStub();

    await withTestApp(
      async ({ app }) => {
        const response = await request(app).get("/api/v1/products").expect(200);

        expect(stub.listPublicProducts).toHaveBeenCalledTimes(1);
        expect(response.body.success).toBe(true);
        expect(response.body.data[0].slug).toBe(product.slug);
      },
      appOptionsWithService(stub as unknown as CatalogService),
    );
  });

  it("returns the popular products feed", async () => {
    const { stub, product } = createCatalogServiceStub();

    await withTestApp(
      async ({ app }) => {
        const response = await request(app).get("/api/v1/products/popular").expect(200);

        expect(stub.listPopularProducts).toHaveBeenCalledWith(
          expect.objectContaining({ limit: 12 }),
        );
        expect(response.body.data[0].id).toBe(product.id);
      },
      appOptionsWithService(stub as unknown as CatalogService),
    );
  });

  it("emits consistent ETag headers for product detail responses", async () => {
    const { stub } = createCatalogServiceStub();
    const { app, cleanup } = createTestApp(
      appOptionsWithService(stub as unknown as CatalogService),
    );

    try {
      const first = await request(app).get("/api/v1/products/aurora-lamp").expect(200);
      const etag = first.headers.etag;
      expect(etag).toBeDefined();

      await request(app).get("/api/v1/products/aurora-lamp").set("If-None-Match", etag).expect(304);

      expect(stub.getProductDetail).toHaveBeenCalledTimes(2);
    } finally {
      await cleanup();
    }
  });
});
