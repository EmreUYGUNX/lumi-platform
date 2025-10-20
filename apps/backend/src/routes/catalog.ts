/* eslint-disable import/order */
import { type RequestHandler, Router } from "express";

import { asyncHandler } from "@/lib/asyncHandler.js";
import { ValidationError } from "@/lib/errors.js";
import { getPrismaClient } from "@/lib/prisma.js";
import { paginatedResponse, successResponse } from "@/lib/response.js";
import { ProductRepository } from "@/modules/product/product.repository.js";
import { ProductService, type ProductServiceContract } from "@/modules/product/product.service.js";
import type { ApplicationConfig } from "@lumi/types";

type RouteRegistrar = (method: string, path: string) => void;

export interface CatalogRouterOptions {
  registerRoute?: RouteRegistrar;
  services?: {
    productService?: ProductServiceContract;
  };
}

const registerRoute = (registrar: RouteRegistrar | undefined, method: string, path: string) => {
  registrar?.(method, path);
};

const createProductService = (): ProductServiceContract => {
  const prisma = getPrismaClient();
  const repository = new ProductRepository(prisma);
  return new ProductService(repository);
};

const createSearchHandler = (service: ProductServiceContract): RequestHandler =>
  asyncHandler(async (req, res) => {
    const result = await service.search(req.query);

    res.json(
      paginatedResponse(result.items, {
        totalItems: result.meta.totalItems,
        page: result.meta.page,
        pageSize: result.meta.pageSize,
        totalPages: result.meta.totalPages,
        hasNextPage: result.meta.hasNextPage,
        hasPreviousPage: result.meta.hasPreviousPage,
      }),
    );
  });

const createDetailHandler = (service: ProductServiceContract): RequestHandler =>
  asyncHandler(async (req, res) => {
    const slug = req.params.slug?.trim();
    if (!slug) {
      throw new ValidationError("Product slug is required.", {
        issues: [
          {
            path: "slug",
            message: "The route parameter `slug` must be provided.",
            code: "MISSING_PARAM",
          },
        ],
      });
    }

    const product = await service.getBySlug(slug);
    res.json(successResponse(product));
  });

/**
 * @openapi
 * /api/v1/catalog/products:
 *   get:
 *     summary: Search catalog products
 *     description: Retrieve a paginated list of products using shared DTO contracts.
 *     tags:
 *       - Catalog
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Free text query matching title, slug, or keywords.
 *       - in: query
 *         name: statuses
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *             enum: [DRAFT, ACTIVE, ARCHIVED]
 *         description: Optional product statuses to include.
 *       - in: query
 *         name: categoryIds
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         description: Filter by category identifiers.
 *       - in: query
 *         name: collectionIds
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         description: Filter by collection identifiers.
 *       - in: query
 *         name: priceMin
 *         schema:
 *           type: string
 *         description: Minimum price boundary.
 *       - in: query
 *         name: priceMax
 *         schema:
 *           type: string
 *         description: Maximum price boundary.
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Pagination page number.
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 200
 *         description: Number of items per page.
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [newest, oldest, price_asc, price_desc, title_asc, title_desc]
 *         description: Optional sort strategy.
 *     responses:
 *       '200':
 *         description: Product search results.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProductCollectionResponse'
 *       '400':
 *         description: Invalid search parameters.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 * /api/v1/catalog/products/{slug}:
 *   get:
 *     summary: Retrieve product details by slug
 *     description: Fetches a single product using the shared DTO mapping pipeline.
 *     tags:
 *       - Catalog
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: Product slug identifier.
 *     responses:
 *       '200':
 *         description: Product found.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/StandardSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/ProductSummary'
 *       '404':
 *         description: Product not found.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 */
export const createCatalogRouter = (
  _config: ApplicationConfig,
  options: CatalogRouterOptions = {},
): Router => {
  const router = Router();
  const { registerRoute: registerCatalogRoute, services } = options;

  const productService = services?.productService ?? createProductService();

  router.get("/products", createSearchHandler(productService));
  registerRoute(registerCatalogRoute, "GET", "/products");

  router.get("/products/:slug", createDetailHandler(productService));
  registerRoute(registerCatalogRoute, "GET", "/products/:slug");

  return router;
};
