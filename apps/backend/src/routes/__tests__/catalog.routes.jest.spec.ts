import { describe, expect, it, jest } from "@jest/globals";
import express from "express";
import request from "supertest";

import { NotFoundError } from "@/lib/errors.js";
import { registerErrorHandlers } from "@/middleware/errorHandler.js";
import { createTestConfig } from "@/testing/config.js";

import { createCatalogRouter } from "../catalog.js";
import { attachRouteRegistry, createRouteRegistrar, createRouteRegistry } from "../registry.js";

/* eslint-disable unicorn/no-null */

const buildApp = (
  overrides: {
    searchResult?: unknown;
    detailResult?: unknown;
    detailError?: Error;
  } = {},
) => {
  const app = express();
  const config = createTestConfig();
  app.locals.config = config;

  const registry = createRouteRegistry();
  attachRouteRegistry(app, registry);
  const registerRoute = createRouteRegistrar(registry, "/catalog");

  const defaultProduct = {
    id: "prod_1",
    title: "Aurora Desk Lamp",
    slug: "aurora-desk-lamp",
    summary: "Ambient lighting",
    description: null,
    status: "ACTIVE",
    price: { amount: "249.90", currency: "TRY" },
    compareAtPrice: null,
    currency: "TRY",
    inventoryPolicy: "TRACK",
    searchKeywords: ["lamp"],
    attributes: null,
    variants: [
      {
        id: "variant_1",
        title: "Default",
        sku: "LAMP-001",
        price: { amount: "249.90", currency: "TRY" },
        compareAtPrice: null,
        stock: 12,
        attributes: null,
        weightGrams: 3500,
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
  };

  const productService = {
    search: jest.fn().mockResolvedValue(
      overrides.searchResult ?? {
        items: [defaultProduct],
        meta: {
          page: 1,
          pageSize: 25,
          totalItems: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      },
    ),
    getBySlug: jest.fn().mockImplementation(async () => {
      if (overrides.detailError) {
        throw overrides.detailError;
      }

      if (overrides.detailResult) {
        return overrides.detailResult;
      }

      return defaultProduct;
    }),
  };

  app.use(
    "/catalog",
    createCatalogRouter(config, {
      registerRoute,
      services: { productService: productService as never },
    }),
  );

  registerErrorHandlers(app, config);

  return { app, productService };
};

describe("catalog routes", () => {
  it("returns paginated search results", async () => {
    const { app, productService } = buildApp();

    const response = await request(app).get("/catalog/products").expect(200);

    expect(productService.search).toHaveBeenCalledTimes(1);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.meta.pagination.totalItems).toBe(1);
  });

  it("returns product details by slug", async () => {
    const product = {
      id: "prod_2",
      title: "Orbit Chair",
      slug: "orbit-chair",
      summary: "Ergonomic desk chair",
      description: null,
      status: "ACTIVE",
      price: { amount: "499.00", currency: "TRY" },
      compareAtPrice: null,
      currency: "TRY",
      inventoryPolicy: "TRACK",
      searchKeywords: [],
      attributes: null,
      variants: [],
      categories: [],
      media: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
    };

    const { app, productService } = buildApp({ detailResult: product });

    const response = await request(app).get("/catalog/products/orbit-chair").expect(200);

    expect(productService.getBySlug).toHaveBeenCalledWith("orbit-chair");
    expect(response.body.data.slug).toBe("orbit-chair");
  });

  it("propagates not found errors", async () => {
    const { app } = buildApp({ detailError: new NotFoundError("product missing") });

    const response = await request(app).get("/catalog/products/missing").expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });
});

/* eslint-enable unicorn/no-null */
