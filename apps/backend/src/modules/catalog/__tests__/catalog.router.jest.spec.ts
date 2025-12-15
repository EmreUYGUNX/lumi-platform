/* eslint-disable @typescript-eslint/ban-ts-comment, unicorn/no-null, prefer-destructuring */
// @ts-nocheck
import { describe, expect, it, jest } from "@jest/globals";
import type { Request, RequestHandler } from "express";
import request from "supertest";

import { NotFoundError } from "@/lib/errors.js";
import type { AuthenticatedUser } from "@/modules/auth/token.types.js";
import { createTestApp, withTestApp } from "@/testing/index.js";

import type { CatalogService } from "../catalog.service.js";

const parseUserHeader = (req: Request): AuthenticatedUser | undefined => {
  const header = req.get("x-auth-user");
  if (!header) {
    return undefined;
  }

  try {
    return JSON.parse(header) as AuthenticatedUser;
  } catch {
    return undefined;
  }
};

const requireAuthMiddleware: RequestHandler = (req, _res, next) => {
  const { UnauthorizedError } = jest.requireActual("@/lib/errors.js") as {
    UnauthorizedError: new (...args: ConstructorParameters<typeof Error>) => Error;
  };

  const user = parseUserHeader(req);
  if (!user) {
    next(new UnauthorizedError("Authentication required."));
    return;
  }

  req.user = user;
  next();
};

jest.mock("@/middleware/auth/requireAuth.js", () => ({
  createRequireAuthMiddleware: () => requireAuthMiddleware,
}));

jest.mock("@/middleware/auth/requireRole.js", () => ({
  createRequireRoleMiddleware: (roles: readonly string[]) =>
    ((req, _res, next) => {
      const { ForbiddenError } = jest.requireActual("@/lib/errors.js") as {
        ForbiddenError: new (...args: ConstructorParameters<typeof Error>) => Error;
      };

      const required = roles.map((role) => role.toLowerCase());
      if (required.length === 0) {
        next();
        return;
      }

      const userRoles = new Set((req.user?.roles ?? []).map((role) => role.name.toLowerCase()));
      const allowed = required.some((role) => userRoles.has(role));
      if (allowed) {
        next();
        return;
      }

      next(new ForbiddenError("You do not have permission to perform this action."));
    }) as RequestHandler,
}));

const buildUser = (roleName: string) =>
  ({
    id: `user_${roleName}`,
    email: `${roleName}@example.com`,
    sessionId: `session_${roleName}`,
    permissions: [],
    token: {
      sub: `user_${roleName}`,
      email: `${roleName}@example.com`,
      sessionId: `session_${roleName}`,
      roleIds: [`role_${roleName}`],
      permissions: [],
      jti: `jti-${roleName}`,
      iat: 0,
      exp: 0,
    },
    roles: [{ id: `role_${roleName}`, name: roleName }],
  }) as AuthenticatedUser;

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
    getAdminProductById: jest.fn().mockResolvedValue(product),
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

  it("returns admin product detail payloads", async () => {
    const { stub, product } = createCatalogServiceStub();
    const adminHeader = JSON.stringify(buildUser("admin"));

    await withTestApp(
      async ({ app }) => {
        const response = await request(app)
          .get(`/api/v1/admin/products/${product.id}`)
          .set("x-auth-user", adminHeader)
          .expect(200);

        expect(stub.getAdminProductById).toHaveBeenCalledWith(product.id);
        expect(response.body.data.id).toBe(product.id);
      },
      appOptionsWithService(stub as unknown as CatalogService),
    );
  });

  it("rejects admin product detail requests from non-admin users", async () => {
    const { stub, product } = createCatalogServiceStub();
    const customerHeader = JSON.stringify(buildUser("customer"));

    await withTestApp(
      async ({ app }) => {
        await request(app)
          .get(`/api/v1/admin/products/${product.id}`)
          .set("x-auth-user", customerHeader)
          .expect(403);
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

  it("supports filtering, pagination, and sorting with Q2 responses for listings", async () => {
    const { stub, product } = createCatalogServiceStub();
    stub.listPublicProducts.mockResolvedValue({
      items: [product],
      meta: {
        page: 2,
        pageSize: 12,
        totalItems: 48,
        totalPages: 4,
        hasNextPage: true,
        hasPreviousPage: true,
      },
      cursor: { hasMore: true, next: "cursor_token" },
    });

    await withTestApp(
      async ({ app }) => {
        const response = await request(app)
          .get("/api/v1/products?categorySlug=lighting&page=2&perPage=12&sort=price_desc")
          .expect(200);

        expect(stub.listPublicProducts).toHaveBeenCalledWith(
          expect.objectContaining({
            categorySlug: "lighting",
            pagination: expect.objectContaining({ page: 2, pageSize: 12 }),
            sort: "price_desc",
          }),
        );
        expect(response.body.success).toBe(true);
        expect(response.body.data[0].slug).toBe(product.slug);
        expect(response.body.meta.pagination.page).toBe(2);
        expect(response.body.meta.pagination.totalItems).toBe(48);
        expect(response.body.meta.cursor.next).toBe("cursor_token");
      },
      appOptionsWithService(stub as unknown as CatalogService),
    );
  });

  it("returns enriched product detail payloads including variants and media", async () => {
    const { stub, product } = createCatalogServiceStub();
    stub.getProductDetail.mockResolvedValue({
      product: {
        ...product,
        media: [
          {
            id: "media_1",
            url: "https://cdn.lumi.test/aurora.jpg",
            type: "image",
            alt: "Aurora Lamp hero",
            isPrimary: true,
          },
        ],
        categories: [
          {
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
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      },
      reviewSummary: {
        totalReviews: 12,
        averageRating: 4.8,
        ratingBreakdown: { 5: 10, 4: 2 },
      },
    });

    await withTestApp(
      async ({ app }) => {
        const response = await request(app).get("/api/v1/products/aurora-lamp").expect(200);

        expect(stub.getProductDetail).toHaveBeenCalledWith("aurora-lamp");
        expect(response.body.data.product.variants[0].sku).toBe("VAR-1");
        expect(response.body.data.product.media[0].url).toContain("aurora");
        expect(response.body.data.reviews.totalReviews).toBe(12);
      },
      appOptionsWithService(stub as unknown as CatalogService),
    );
  });

  it("returns 404 errors in Q2 format when product slugs are unknown", async () => {
    const { stub } = createCatalogServiceStub();
    stub.getProductDetail.mockRejectedValue(new NotFoundError("Product not found"));

    await withTestApp(
      async ({ app }) => {
        const response = await request(app).get("/api/v1/products/missing").expect(404);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe("NOT_FOUND");
      },
      appOptionsWithService(stub as unknown as CatalogService),
    );
  });
});
