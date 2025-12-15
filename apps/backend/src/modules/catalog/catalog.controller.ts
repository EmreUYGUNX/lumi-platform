/* istanbul ignore file */

/* controller glue validated through catalog integration tests */

/* eslint-disable sonarjs/no-duplicate-string */
import { createHash } from "node:crypto";

import type { Request, RequestHandler, Response } from "express";

import { asyncHandler } from "@/lib/asyncHandler.js";
import { ValidationError } from "@/lib/errors.js";
import { paginatedResponse, successResponse } from "@/lib/response.js";

import type { CatalogService } from "./catalog.service.js";
import {
  categoryCreateSchema,
  categoryTreeQuerySchema,
  categoryUpdateSchema,
  popularProductsQuerySchema,
  productCreateSchema,
  productListQuerySchema,
  productUpdateSchema,
  productVariantCreateSchema,
  productVariantUpdateSchema,
  variantQuerySchema,
} from "./catalog.validators.js";

const computeEtag = (payload: unknown): string => {
  const normalised = JSON.stringify(payload);
  return createHash("sha256").update(normalised).digest("hex");
};

export interface CatalogControllerOptions {
  service: CatalogService;
}

export class CatalogController {
  public readonly listProducts: RequestHandler;

  public readonly listPopularProducts: RequestHandler;

  public readonly getProduct: RequestHandler;

  public readonly getAdminProduct: RequestHandler;

  public readonly listProductReviews: RequestHandler;

  public readonly listVariants: RequestHandler;

  public readonly createProduct: RequestHandler;

  public readonly updateProduct: RequestHandler;

  public readonly deleteProduct: RequestHandler;

  public readonly addVariant: RequestHandler;

  public readonly updateVariant: RequestHandler;

  public readonly deleteVariant: RequestHandler;

  public readonly listCategories: RequestHandler;

  public readonly getCategory: RequestHandler;

  public readonly createCategory: RequestHandler;

  public readonly updateCategory: RequestHandler;

  public readonly deleteCategory: RequestHandler;

  private readonly service: CatalogService;

  constructor(options: CatalogControllerOptions) {
    this.service = options.service;

    this.listProducts = asyncHandler(this.handleListProducts.bind(this));
    this.listPopularProducts = asyncHandler(this.handleListPopularProducts.bind(this));
    this.getProduct = asyncHandler(this.handleGetProduct.bind(this));
    this.getAdminProduct = asyncHandler(this.handleGetAdminProduct.bind(this));
    this.listProductReviews = asyncHandler(this.handleListProductReviews.bind(this));
    this.listVariants = asyncHandler(this.handleListVariants.bind(this));
    this.createProduct = asyncHandler(this.handleCreateProduct.bind(this));
    this.updateProduct = asyncHandler(this.handleUpdateProduct.bind(this));
    this.deleteProduct = asyncHandler(this.handleDeleteProduct.bind(this));
    this.addVariant = asyncHandler(this.handleAddVariant.bind(this));
    this.updateVariant = asyncHandler(this.handleUpdateVariant.bind(this));
    this.deleteVariant = asyncHandler(this.handleDeleteVariant.bind(this));
    this.listCategories = asyncHandler(this.handleListCategories.bind(this));
    this.getCategory = asyncHandler(this.handleGetCategory.bind(this));
    this.createCategory = asyncHandler(this.handleCreateCategory.bind(this));
    this.updateCategory = asyncHandler(this.handleUpdateCategory.bind(this));
    this.deleteCategory = asyncHandler(this.handleDeleteCategory.bind(this));
  }

  private async handleListProducts(req: Request, res: Response): Promise<void> {
    const params = productListQuerySchema.parse(req.query);

    const query = {
      ...req.query,
      pagination: {
        page: params.page ?? req.query.page,
        pageSize: params.perPage ?? (req.query as Record<string, unknown>).pageSize,
      },
    };

    if (params.categoryId) {
      (query as Record<string, unknown>).categoryId = params.categoryId;
    }

    if (params.categorySlug) {
      (query as Record<string, unknown>).categorySlug = params.categorySlug;
    }

    const result = await this.service.listPublicProducts(query);

    const responseSnapshot = {
      items: result.items,
      meta: result.meta,
      cursor: result.cursor,
    };
    const etag = computeEtag(responseSnapshot);

    if (req.headers["if-none-match"] === etag) {
      res.status(304).end();
      return;
    }

    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "public, max-age=60");

    res.json(
      paginatedResponse(result.items, {
        totalItems: result.meta.totalItems,
        page: result.meta.page,
        pageSize: result.meta.pageSize,
        totalPages: result.meta.totalPages,
        hasNextPage: result.meta.hasNextPage,
        hasPreviousPage: result.meta.hasPreviousPage,
        meta: result.cursor ? { cursor: result.cursor } : undefined,
      }),
    );
  }

  private async handleListPopularProducts(req: Request, res: Response): Promise<void> {
    const params = popularProductsQuerySchema.parse(req.query);
    const limit = params.limit ?? 12;
    const products = await this.service.listPopularProducts({
      limit,
      refreshCache: params.refreshCache,
    });

    const payload = {
      limit,
      items: products,
    };
    const etag = computeEtag(payload);

    if (req.headers["if-none-match"] === etag) {
      res.status(304).end();
      return;
    }

    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "public, max-age=300");

    res.json(
      successResponse(products, {
        popular: {
          limit,
        },
      }),
    );
  }

  private async handleGetProduct(req: Request, res: Response): Promise<void> {
    const { slug } = req.params;
    if (!slug) {
      throw new ValidationError("Product slug is required.", {
        issues: [
          {
            path: "slug",
            message: "Product slug must be provided in the route.",
          },
        ],
      });
    }

    const result = await this.service.getProductDetail(slug);
    const payload = {
      product: result.product,
      reviews: result.reviewSummary,
    };
    const etag = computeEtag(payload);

    if (req.headers["if-none-match"] === etag) {
      res.status(304).end();
      return;
    }

    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "private, max-age=60");
    res.json(successResponse(payload));
  }

  private async handleGetAdminProduct(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    if (!id) {
      throw new ValidationError("Product identifier is required.", {
        issues: [
          {
            path: "id",
            message: "Product identifier must be provided in the route.",
          },
        ],
      });
    }

    const summary = await this.service.getAdminProductById(id);

    res.json(successResponse(summary));
  }

  private async handleListProductReviews(req: Request, res: Response): Promise<void> {
    const { slug } = req.params;
    if (!slug) {
      throw new ValidationError("Product slug is required.", {
        issues: [
          {
            path: "slug",
            message: "Product slug must be provided in the route.",
          },
        ],
      });
    }

    const reviews = await this.service.listProductReviews(slug);
    res.setHeader("Cache-Control", "public, max-age=120");
    res.json(successResponse(reviews));
  }

  private async handleListVariants(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    if (!id) {
      throw new ValidationError("Product identifier is required.", {
        issues: [
          {
            path: "id",
            message: "Product identifier must be provided in the route.",
          },
        ],
      });
    }

    const query = variantQuerySchema.parse(req.query);
    const variants = await this.service.listProductVariants(id, {
      includeOutOfStock: query.inStock !== true,
    });

    res.json(successResponse(variants));
  }

  private async handleCreateProduct(req: Request, res: Response): Promise<void> {
    const body = productCreateSchema.parse(req.body);
    const summary = await this.service.createProduct(body);

    res.locals.audit = {
      entity: "products",
      entityId: summary.id,
      action: "products.create",
      after: summary,
    };

    res.status(201).json(successResponse(summary));
  }

  private async handleUpdateProduct(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    if (!id) {
      throw new ValidationError("Product identifier is required.", {
        issues: [
          {
            path: "id",
            message: "Product identifier must be provided in the route.",
          },
        ],
      });
    }
    const body = productUpdateSchema.parse(req.body);
    const summary = await this.service.updateProduct(id, body);

    res.locals.audit = {
      entity: "products",
      entityId: summary.id,
      action: "products.update",
      after: summary,
    };

    res.json(successResponse(summary));
  }

  private async handleDeleteProduct(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    if (!id) {
      throw new ValidationError("Product identifier is required.", {
        issues: [
          {
            path: "id",
            message: "Product identifier must be provided in the route.",
          },
        ],
      });
    }
    await this.service.archiveProduct(id);

    res.locals.audit = {
      entity: "products",
      entityId: id,
      action: "products.archive",
    };

    res.status(204).end();
  }

  private async handleAddVariant(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    if (!id) {
      throw new ValidationError("Product identifier is required.", {
        issues: [
          {
            path: "id",
            message: "Product identifier must be provided in the route.",
          },
        ],
      });
    }
    const body = productVariantCreateSchema.parse(req.body);
    const variant = await this.service.addVariant(id, body);

    res.locals.audit = {
      entity: "products",
      entityId: id,
      action: "products.variant.create",
      after: { ...variant },
    };

    res.status(201).json(successResponse(variant));
  }

  private async handleUpdateVariant(req: Request, res: Response): Promise<void> {
    const { id, variantId } = req.params;
    if (!id) {
      throw new ValidationError("Product identifier is required.", {
        issues: [
          {
            path: "id",
            message: "Product identifier must be provided in the route.",
          },
        ],
      });
    }
    if (!variantId) {
      throw new ValidationError("Variant identifier is required.", {
        issues: [
          {
            path: "variantId",
            message: "Variant identifier must be provided in the route.",
          },
        ],
      });
    }
    const body = productVariantUpdateSchema.parse(req.body);
    const variant = await this.service.updateVariant(id, variantId, body);

    res.locals.audit = {
      entity: "products",
      entityId: id,
      action: "products.variant.update",
      after: { ...variant },
    };

    res.json(successResponse(variant));
  }

  private async handleDeleteVariant(req: Request, res: Response): Promise<void> {
    const { id, variantId } = req.params;
    if (!id) {
      throw new ValidationError("Product identifier is required.", {
        issues: [
          {
            path: "id",
            message: "Product identifier must be provided in the route.",
          },
        ],
      });
    }
    if (!variantId) {
      throw new ValidationError("Variant identifier is required.", {
        issues: [
          {
            path: "variantId",
            message: "Variant identifier must be provided in the route.",
          },
        ],
      });
    }
    await this.service.deleteVariant(id, variantId);

    res.locals.audit = {
      entity: "products",
      entityId: id,
      action: "products.variant.delete",
      metadata: { variantId },
    };

    res.status(204).end();
  }

  private async handleListCategories(req: Request, res: Response): Promise<void> {
    const query = categoryTreeQuerySchema.parse(req.query);
    const categories = await this.service.listCategories({
      depth: query.depth,
      refresh: query.refresh,
    });

    res.setHeader("Cache-Control", "public, max-age=900");
    res.json(successResponse(categories));
  }

  private async handleGetCategory(req: Request, res: Response): Promise<void> {
    const { slug } = req.params;
    if (!slug) {
      throw new ValidationError("Category slug is required.", {
        issues: [
          {
            path: "slug",
            message: "Category slug must be provided in the route.",
          },
        ],
      });
    }
    const page = Number.parseInt(String(req.query.page ?? "1"), 10) || 1;
    const perPage = Number.parseInt(String(req.query.perPage ?? "24"), 10) || 24;

    const detail = await this.service.getCategoryDetail(slug, { page, perPage });
    res.json(successResponse(detail));
  }

  private async handleCreateCategory(req: Request, res: Response): Promise<void> {
    const body = categoryCreateSchema.parse(req.body);
    const category = await this.service.createCategory(body);

    res.locals.audit = {
      entity: "categories",
      entityId: category.id,
      action: "categories.create",
      after: category,
    };

    res.status(201).json(successResponse(category));
  }

  private async handleUpdateCategory(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    if (!id) {
      throw new ValidationError("Category identifier is required.", {
        issues: [
          {
            path: "id",
            message: "Category identifier must be provided in the route.",
          },
        ],
      });
    }
    const body = categoryUpdateSchema.parse(req.body);
    const category = await this.service.updateCategory(id, body);

    res.locals.audit = {
      entity: "categories",
      entityId: category.id,
      action: "categories.update",
      after: category,
    };

    res.json(successResponse(category));
  }

  private async handleDeleteCategory(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    if (!id) {
      throw new ValidationError("Category identifier is required.", {
        issues: [
          {
            path: "id",
            message: "Category identifier must be provided in the route.",
          },
        ],
      });
    }
    await this.service.deleteCategory(id);

    res.locals.audit = {
      entity: "categories",
      entityId: id,
      action: "categories.delete",
    };

    res.status(204).end();
  }
}
