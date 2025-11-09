/* eslint-disable unicorn/no-null */
import { createHash } from "node:crypto";

import type { NextFunction, Request, Response } from "express";

import { ValidationError } from "@/lib/errors.js";

import { CatalogController } from "../catalog.controller.js";
import type {
  CatalogService,
  CategoryDetailResult,
  ProductDetailResult,
  ProductVariantSummary,
} from "../catalog.service.js";

const PRODUCT_ID = "clprodaurora0000000000000";
const VARIANT_ID = "clvariantprime00000000000";
const CATEGORY_ID = "clcategoryroot00000000000";
const ISO_TIMESTAMP = "2025-01-01T00:00:00.000Z";

const productSummary = {
  id: PRODUCT_ID,
  title: "Aurora Desk Lamp",
  slug: "aurora-desk-lamp",
  sku: null,
  summary: "Ambient lighting",
  description: null,
  status: "ACTIVE" as const,
  price: { amount: "199.00", currency: "TRY" },
  compareAtPrice: undefined,
  currency: "TRY",
  inventoryPolicy: "TRACK" as const,
  searchKeywords: ["aurora"],
  attributes: null,
  variants: [
    {
      id: VARIANT_ID,
      title: "Default",
      sku: "AURORA-1",
      price: { amount: "199.00", currency: "TRY" },
      compareAtPrice: undefined,
      stock: 5,
      attributes: null,
      weightGrams: null,
      isPrimary: true,
      createdAt: ISO_TIMESTAMP,
      updatedAt: ISO_TIMESTAMP,
    },
  ],
  categories: [
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
      createdAt: ISO_TIMESTAMP,
      updatedAt: ISO_TIMESTAMP,
    },
  ],
  media: [],
  createdAt: ISO_TIMESTAMP,
  updatedAt: ISO_TIMESTAMP,
  deletedAt: null,
};

const reviewSummary: ProductDetailResult["reviewSummary"] = {
  totalReviews: 10,
  averageRating: 4.5,
  ratingBreakdown: { 5: 7, 4: 3 },
};

const paginatedProducts = {
  items: [productSummary],
  meta: {
    totalItems: 1,
    totalPages: 1,
    page: 1,
    pageSize: 24,
    hasNextPage: false,
    hasPreviousPage: false,
  },
};

const categorySummary = productSummary.categories[0]!;

const categoryDetail: CategoryDetailResult = {
  category: categorySummary,
  subcategories: [],
  breadcrumbs: [categorySummary],
  products: paginatedProducts,
};

const variantSummary: ProductVariantSummary = {
  id: VARIANT_ID,
  title: "Default",
  sku: "AURORA-1",
  price: { amount: "199.00", currency: "TRY" },
  compareAtPrice: undefined,
  priceDifference: undefined,
  stock: 5,
  isPrimary: true,
  availability: "in_stock",
  attributes: null,
  media: [],
};

const createService = (): jest.Mocked<CatalogService> =>
  ({
    listPublicProducts: jest.fn().mockResolvedValue(paginatedProducts),
    getProductDetail: jest.fn().mockResolvedValue({ product: productSummary, reviewSummary }),
    listProductVariants: jest.fn().mockResolvedValue([variantSummary]),
    createProduct: jest.fn().mockResolvedValue(productSummary),
    updateProduct: jest.fn().mockResolvedValue(productSummary),
    archiveProduct: jest.fn(),
    addVariant: jest.fn().mockResolvedValue(variantSummary),
    updateVariant: jest.fn().mockResolvedValue(variantSummary),
    deleteVariant: jest.fn(),
    listCategories: jest.fn().mockResolvedValue([categorySummary]),
    listPopularProducts: jest.fn().mockResolvedValue([productSummary]),
    getCategoryDetail: jest.fn().mockResolvedValue(categoryDetail),
    createCategory: jest.fn().mockResolvedValue(categorySummary),
    updateCategory: jest.fn().mockResolvedValue(categorySummary),
    deleteCategory: jest.fn(),
  }) as unknown as jest.Mocked<CatalogService>;

const createResponse = (): Response => {
  const res = {
    json: jest.fn(),
    status: jest.fn().mockReturnThis(),
    setHeader: jest.fn() as jest.Mock,
    end: jest.fn(),
    locals: {},
  };
  return res as unknown as Response;
};

const createRequest = (overrides: Partial<Request> = {}): Request =>
  ({
    params: {},
    query: {},
    body: {},
    headers: {},
    ...overrides,
  }) as Request;

describe("CatalogController", () => {
  let service: jest.Mocked<CatalogService>;
  let controller: CatalogController;

  beforeEach(() => {
    service = createService();
    controller = new CatalogController({ service });
  });

  it("lists products with pagination metadata", async () => {
    const req = createRequest({ query: { page: "2", perPage: "12" } });
    const res = createResponse();
    const next = jest.fn();

    await controller.listProducts(req, res, next as NextFunction);

    expect(service.listPublicProducts).toHaveBeenCalledWith(
      expect.objectContaining({
        pagination: expect.objectContaining({ page: 2, pageSize: 12 }),
      }),
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: paginatedProducts.items,
        meta: expect.objectContaining({
          pagination: expect.objectContaining({ totalItems: 1 }),
        }),
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("sets caching headers and handles ETag for product listings", async () => {
    const req = createRequest({ query: {} });
    const res = createResponse();

    await controller.listProducts(req, res, jest.fn());

    const setHeaderMock = res.setHeader as unknown as jest.Mock;
    const etagCall = setHeaderMock.mock.calls.find((call: [string, unknown]) => call[0] === "ETag");
    const etag = etagCall?.[1];
    expect(etag).toBeDefined();
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "public, max-age=60");

    const cachedReq = createRequest({ headers: { "if-none-match": etag } });
    const cachedRes = createResponse();

    await controller.listProducts(cachedReq, cachedRes, jest.fn());

    expect(cachedRes.status).toHaveBeenCalledWith(304);
    expect(cachedRes.end).toHaveBeenCalled();
    expect(cachedRes.json).not.toHaveBeenCalled();
  });

  it("returns cached payloads for the popular products endpoint", async () => {
    const req = createRequest({ query: { limit: "5" } });
    const res = createResponse();

    await controller.listPopularProducts(req, res, jest.fn());

    expect(service.listPopularProducts).toHaveBeenCalledWith(expect.objectContaining({ limit: 5 }));
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "public, max-age=300");
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: expect.any(Array) }));
  });

  it("returns product detail and sets ETag headers", async () => {
    const req = createRequest({ params: { slug: "aurora-desk-lamp" } });
    const res = createResponse();

    await controller.getProduct(req, res, jest.fn());

    const payload = { product: productSummary, reviews: reviewSummary };
    const expectedEtag = createHash("sha256").update(JSON.stringify(payload)).digest("hex");

    expect(service.getProductDetail).toHaveBeenCalledWith("aurora-desk-lamp");
    expect(res.setHeader).toHaveBeenCalledWith("ETag", expectedEtag);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: payload }));
  });

  it("responds with 304 when client ETag matches", async () => {
    const req = createRequest({ params: { slug: "aurora-desk-lamp" } });
    const res = createResponse();

    // Pre-compute expected ETag to simulate cached client request
    const payload = { product: productSummary, reviews: reviewSummary };
    const etag = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
    req.headers = { "if-none-match": etag };

    await controller.getProduct(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(304);
    expect(res.end).toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it("propagates validation errors when product slug is missing", async () => {
    const req = createRequest({ params: {} });
    const res = createResponse();
    const next = jest.fn();

    await controller.getProduct(req, res, next as NextFunction);

    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
  });

  it("lists variants filtering out-of-stock entries when requested", async () => {
    const req = createRequest({ params: { id: PRODUCT_ID }, query: { inStock: "true" } });
    const res = createResponse();

    await controller.listVariants(req, res, jest.fn());

    expect(service.listProductVariants).toHaveBeenCalledWith(PRODUCT_ID, {
      includeOutOfStock: false,
    });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: [variantSummary] }));
  });

  it("rejects variant requests without product id", async () => {
    const req = createRequest({ params: {} });
    const res = createResponse();
    const next = jest.fn();

    await controller.listVariants(req, res, next as NextFunction);

    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
  });

  it("creates products and registers audit metadata", async () => {
    const req = createRequest({
      body: {
        title: "Aurora",
        price: { amount: "199.00", currency: "TRY" },
        variants: [
          {
            title: "Default",
            price: { amount: "199.00", currency: "TRY" },
            stock: 5,
          },
        ],
        categoryIds: [CATEGORY_ID],
      },
    });
    const res = createResponse();

    await controller.createProduct(req, res, jest.fn());

    expect(service.createProduct).toHaveBeenCalled();
    expect(res.locals.audit).toMatchObject({
      entity: "products",
      action: "products.create",
      after: productSummary,
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("collects audit metadata when updating products", async () => {
    const req = createRequest({ params: { id: PRODUCT_ID }, body: { title: "Updated" } });
    const res = createResponse();

    await controller.updateProduct(req, res, jest.fn());

    expect(service.updateProduct).toHaveBeenCalledWith(PRODUCT_ID, { title: "Updated" });
    expect(res.locals.audit).toMatchObject({
      entity: "products",
      action: "products.update",
      after: productSummary,
    });
  });

  it("rejects product updates without identifier", async () => {
    const req = createRequest({ params: {}, body: {} });
    const res = createResponse();
    const next = jest.fn();

    await controller.updateProduct(req, res, next as NextFunction);

    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
  });

  it("archives products and returns no content", async () => {
    const req = createRequest({ params: { id: PRODUCT_ID } });
    const res = createResponse();

    await controller.deleteProduct(req, res, jest.fn());

    expect(service.archiveProduct).toHaveBeenCalledWith(PRODUCT_ID);
    expect(res.locals.audit).toMatchObject({
      entity: "products",
      action: "products.archive",
    });
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it("adds variants and records audit trail", async () => {
    const req = createRequest({
      params: { id: PRODUCT_ID },
      body: { title: "Large", price: { amount: "220.00", currency: "TRY" } },
    });
    const res = createResponse();

    await controller.addVariant(req, res, jest.fn());

    expect(service.addVariant).toHaveBeenCalledWith(
      PRODUCT_ID,
      expect.objectContaining({
        ...req.body,
        stock: 0,
      }),
    );
    expect(res.locals.audit).toMatchObject({
      entity: "products",
      action: "products.variant.create",
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("rejects variant updates without identifier", async () => {
    const req = createRequest({ params: { id: PRODUCT_ID }, body: {} });
    const res = createResponse();
    const next = jest.fn();

    await controller.updateVariant(req, res, next as NextFunction);

    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
  });

  it("updates variants and returns payload", async () => {
    const req = createRequest({
      params: { id: PRODUCT_ID, variantId: VARIANT_ID },
      body: { stock: 10 },
    });
    const res = createResponse();

    await controller.updateVariant(req, res, jest.fn());

    expect(service.updateVariant).toHaveBeenCalledWith(PRODUCT_ID, VARIANT_ID, { stock: 10 });
    expect(res.locals.audit).toMatchObject({
      entity: "products",
      action: "products.variant.update",
    });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: variantSummary }));
  });

  it("deletes variants and records audit metadata", async () => {
    const req = createRequest({ params: { id: PRODUCT_ID, variantId: VARIANT_ID } });
    const res = createResponse();

    await controller.deleteVariant(req, res, jest.fn());

    expect(service.deleteVariant).toHaveBeenCalledWith(PRODUCT_ID, VARIANT_ID);
    expect(res.locals.audit).toMatchObject({
      entity: "products",
      action: "products.variant.delete",
    });
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it("returns cached category trees", async () => {
    const req = createRequest({ query: { depth: "2" } });
    const res = createResponse();

    await controller.listCategories(req, res, jest.fn());

    expect(service.listCategories).toHaveBeenCalledWith({ depth: 2, refresh: undefined });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: [categorySummary] }));
  });

  it("retrieves category details with pagination", async () => {
    const req = createRequest({
      params: { slug: "lighting" },
      query: { page: "2", perPage: "12" },
    });
    const res = createResponse();

    await controller.getCategory(req, res, jest.fn());

    expect(service.getCategoryDetail).toHaveBeenCalledWith("lighting", { page: 2, perPage: 12 });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: categoryDetail }));
  });

  it("rejects category requests without slug", async () => {
    const req = createRequest({ params: {} });
    const res = createResponse();
    const next = jest.fn();

    await controller.getCategory(req, res, next as NextFunction);

    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
  });

  it("creates categories and populates audit trail", async () => {
    const req = createRequest({ body: { name: "Lighting" } });
    const res = createResponse();

    await controller.createCategory(req, res, jest.fn());

    expect(service.createCategory).toHaveBeenCalledWith(req.body);
    expect(res.locals.audit).toMatchObject({
      entity: "categories",
      action: "categories.create",
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("updates categories and refreshes audit metadata", async () => {
    const req = createRequest({ params: { id: CATEGORY_ID }, body: { name: "Fixtures" } });
    const res = createResponse();

    await controller.updateCategory(req, res, jest.fn());

    expect(service.updateCategory).toHaveBeenCalledWith(CATEGORY_ID, { name: "Fixtures" });
    expect(res.locals.audit).toMatchObject({
      entity: "categories",
      action: "categories.update",
    });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: categorySummary }));
  });

  it("rejects category updates without identifier", async () => {
    const req = createRequest({ params: {}, body: {} });
    const res = createResponse();
    const next = jest.fn();

    await controller.updateCategory(req, res, next as NextFunction);

    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
  });

  it("deletes categories and clears audit metadata", async () => {
    const req = createRequest({ params: { id: CATEGORY_ID } });
    const res = createResponse();

    await controller.deleteCategory(req, res, jest.fn());

    expect(service.deleteCategory).toHaveBeenCalledWith(CATEGORY_ID);
    expect(res.locals.audit).toMatchObject({
      entity: "categories",
      action: "categories.delete",
    });
    expect(res.status).toHaveBeenCalledWith(204);
  });
});
