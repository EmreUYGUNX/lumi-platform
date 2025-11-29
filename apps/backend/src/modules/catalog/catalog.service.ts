/* eslint-disable sonarjs/cognitive-complexity, sonarjs/no-duplicate-string, unicorn/no-null */
import { performance } from "node:perf_hooks";

import { InventoryPolicy, Prisma, ProductStatus, ReviewStatus } from "@prisma/client";
import type { Category, PrismaClient } from "@prisma/client";

import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors.js";
import { createChildLogger } from "@/lib/logger.js";
import { getPrismaClient } from "@/lib/prisma.js";
import type { PaginatedResult } from "@/lib/repository/base.repository.js";
import { deriveSearchKeywords, generateSlug } from "@/lib/string.js";
import { CategoryRepository } from "@/modules/category/category.repository.js";
import type { CategoryNode } from "@/modules/category/category.repository.js";
import { ProductRepository } from "@/modules/product/product.repository.js";
import { ProductService } from "@/modules/product/product.service.js";
import type {
  CategoryCreateRequestDTO,
  CategorySummaryDTO,
  CategoryUpdateRequestDTO,
  MoneyDTO,
  ProductCreateRequestDTO,
  ProductSummaryDTO,
  ProductUpdateRequestDTO,
  ProductVariantInputDTO,
  ProductVariantUpdateDTO,
  ProductWithRelations,
} from "@lumi/shared/dto";
import { mapProductToSummary } from "@lumi/shared/dto";

import { type CatalogCache, type CategoryTreeNode, createCatalogCache } from "./catalog.cache.js";

const DEFAULT_CATEGORY_DEPTH = 3;
const SLOW_PRODUCT_QUERY_THRESHOLD_MS = 120;

export interface ReviewSummary {
  totalReviews: number;
  averageRating: number;
  ratingBreakdown: Record<number, number>;
}

export interface ProductDetailResult {
  product: ProductSummaryDTO;
  reviewSummary: ReviewSummary;
}

export interface ProductReviewPublic {
  id: string;
  productId: string;
  userName: string;
  avatarUrl?: string | null;
  rating: number;
  title: string;
  content: string | null;
  isVerifiedPurchase: boolean;
  helpfulCount: number;
  notHelpfulCount: number;
  createdAt: string;
  media: {
    id: string;
    url: string;
    alt: string | null;
  }[];
}

export interface ProductVariantSummary {
  id: string;
  title: string;
  sku: string;
  price: MoneyDTO;
  compareAtPrice?: MoneyDTO;
  priceDifference?: MoneyDTO;
  stock: number;
  isPrimary: boolean;
  availability: "in_stock" | "out_of_stock" | "low_stock";
  attributes: Record<string, unknown> | null;
  media: {
    id: string;
    url: string;
    type: string;
    alt: string | null;
    sortOrder: number | null;
    isPrimary: boolean;
  }[];
}

export interface CategoryDetailResult {
  category: CategorySummaryDTO;
  subcategories: CategorySummaryDTO[];
  breadcrumbs: CategorySummaryDTO[];
  products: PaginatedResult<ProductSummaryDTO>;
}

type ProductEntityWithVariants = Prisma.ProductGetPayload<{
  include: {
    variants: true;
  };
}>;

interface CatalogServiceOptions {
  productRepository?: ProductRepository;
  categoryRepository?: CategoryRepository;
  prisma?: PrismaClient;
  cache?: CatalogCache;
  logger?: ReturnType<typeof createChildLogger>;
}

const formatMoney = (amount: Prisma.Decimal | number | string, currency: string): MoneyDTO => {
  const decimal = amount instanceof Prisma.Decimal ? amount : new Prisma.Decimal(amount);
  return {
    amount: decimal.toFixed(2),
    currency,
  };
};

const determineAvailability = (stock: number): ProductVariantSummary["availability"] => {
  if (stock <= 0) {
    return "out_of_stock";
  }

  if (stock <= 5) {
    return "low_stock";
  }

  return "in_stock";
};

const stableStringify = (input: unknown): string => {
  const seen = new WeakSet<object>();

  const normalise = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map((entry) => normalise(entry));
    }

    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      if (seen.has(record)) {
        return record;
      }

      seen.add(record);

      const normalisedEntries = Object.entries(record)
        .filter(([, entryValue]) => entryValue !== undefined)
        .map(([key, entryValue]) => [key, normalise(entryValue)] as [string, unknown])
        .sort(([left], [right]) => left.localeCompare(right));

      return Object.fromEntries(normalisedEntries);
    }

    return value;
  };

  return JSON.stringify(normalise(input));
};

export class CatalogService {
  private readonly productRepository: ProductRepository;

  private readonly categoryRepository: CategoryRepository;

  private readonly prisma: PrismaClient;

  private readonly cache: CatalogCache;

  private readonly logger: ReturnType<typeof createChildLogger>;

  private readonly productService: ProductService;

  constructor(options: CatalogServiceOptions = {}) {
    this.productRepository = options.productRepository ?? new ProductRepository(getPrismaClient());
    this.categoryRepository =
      options.categoryRepository ?? new CategoryRepository(getPrismaClient());
    this.prisma = options.prisma ?? getPrismaClient();
    this.cache = options.cache ?? createCatalogCache();
    this.logger = options.logger ?? createChildLogger("catalog:service");
    this.productService = new ProductService(this.productRepository);
  }

  async listPublicProducts(query: unknown): Promise<PaginatedResult<ProductSummaryDTO>> {
    const baseInput =
      query && typeof query === "object" ? { ...(query as Record<string, unknown>) } : {};

    const {
      filter: baseFilterInput,
      pagination: basePaginationInput,
      refreshCache,
      categorySlug: rawCategorySlug,
      ...rest
    } = baseInput;

    const { page, perPage, pageSize, ...topLevelFilters } = rest;

    const refreshCacheFlag = refreshCache === true || String(refreshCache).toLowerCase() === "true";

    const cursorTokenCandidate =
      typeof baseInput.cursor === "string"
        ? baseInput.cursor
        : typeof topLevelFilters.cursor === "string"
          ? (topLevelFilters.cursor as string)
          : undefined;
    const shouldUseCache = !refreshCacheFlag && !cursorTokenCandidate;

    const cacheKey = stableStringify({ scope: "products", query: baseInput });
    if (shouldUseCache) {
      const cached = await this.cache.getProductList(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const nestedFilter =
      baseFilterInput && typeof baseFilterInput === "object"
        ? { ...(baseFilterInput as Record<string, unknown>) }
        : {};

    const filterCandidate: Record<string, unknown> = {
      ...topLevelFilters,
      ...nestedFilter,
    };

    delete filterCandidate.cursor;
    delete filterCandidate.take;

    delete filterCandidate.status;
    delete filterCandidate.statuses;
    delete filterCandidate.includeDeleted;
    filterCandidate.statuses = ["ACTIVE"];

    const paginationCandidate: Record<string, unknown> =
      basePaginationInput && typeof basePaginationInput === "object"
        ? { ...(basePaginationInput as Record<string, unknown>) }
        : {};

    if (page !== undefined) {
      paginationCandidate.page = page;
    }

    if (perPage !== undefined) {
      paginationCandidate.pageSize = perPage;
    }

    if (pageSize !== undefined) {
      paginationCandidate.pageSize = pageSize;
    }

    let categorySlug: string | undefined;
    if (typeof rawCategorySlug === "string" && rawCategorySlug.trim().length > 0) {
      categorySlug = rawCategorySlug.trim();
    } else if (
      typeof filterCandidate.categorySlug === "string" &&
      (filterCandidate.categorySlug as string).trim().length > 0
    ) {
      categorySlug = (filterCandidate.categorySlug as string).trim();
    } else if (
      typeof nestedFilter.categorySlug === "string" &&
      (nestedFilter.categorySlug as string).trim().length > 0
    ) {
      categorySlug = (nestedFilter.categorySlug as string).trim();
    }

    delete filterCandidate.categorySlug;

    let slugCategoryId: string | undefined;
    if (categorySlug) {
      const category = await this.categoryRepository.findBySlug(categorySlug);
      if (!category) {
        return CatalogService.buildEmptyProductResult(paginationCandidate);
      }
      slugCategoryId = category.id;
    }

    if (slugCategoryId) {
      const normaliseIds = new Set<string>();

      const ingest = (value: unknown) => {
        if (!value) {
          return;
        }

        if (typeof value === "string") {
          const trimmed = value.trim();
          if (trimmed.length > 0) {
            normaliseIds.add(trimmed);
          }
          return;
        }

        if (Array.isArray(value)) {
          value.forEach((entry) => ingest(entry));
        }
      };

      ingest(filterCandidate.categoryIds);
      ingest(filterCandidate.categoryId);
      normaliseIds.add(slugCategoryId);

      filterCandidate.categoryIds = [...normaliseIds];
      delete filterCandidate.categoryId;
    }

    const paginationInput: Record<string, unknown> = {
      ...paginationCandidate,
    };

    if (paginationInput.pageSize === undefined) {
      paginationInput.pageSize = 24;
    }

    const searchInput = {
      filter: filterCandidate,
      pagination: paginationInput,
    };

    const startedAt = performance.now();
    const result = await this.productService.search(searchInput);
    const durationMs = performance.now() - startedAt;

    if (durationMs > SLOW_PRODUCT_QUERY_THRESHOLD_MS) {
      this.logger.warn("Catalog product search exceeded latency budget", {
        durationMs: Number(durationMs.toFixed(2)),
        page: result.meta.page,
        pageSize: result.meta.pageSize,
        filterCount: Object.keys(filterCandidate).length,
      });
    }

    if (shouldUseCache) {
      await this.cache.setProductList(cacheKey, result);
    }

    return result;
  }

  async getProductDetail(_slug: string): Promise<ProductDetailResult> {
    const slug = _slug.trim();
    const product = await this.productRepository.findBySlug(slug, {
      include: {
        variants: true,
        categories: { include: { category: true } },
        productMedia: { include: { media: true } },
      },
    });

    if (!product || product.status !== ProductStatus.ACTIVE || product.deletedAt) {
      throw new NotFoundError("Product not found.", {
        details: { slug },
      });
    }

    const summary = mapProductToSummary(product);
    const reviewSummary = await this.calculateReviewSummary(product.id);

    return {
      product: summary,
      reviewSummary,
    };
  }

  async listProductReviews(_slug: string): Promise<ProductReviewPublic[]> {
    const slug = _slug.trim();
    const product = await this.productRepository.findBySlug(slug, {
      select: {
        id: true,
        slug: true,
        status: true,
        deletedAt: true,
      },
    });

    if (!product || product.status !== ProductStatus.ACTIVE || product.deletedAt) {
      throw new NotFoundError("Product not found.", { details: { slug } });
    }

    type ReviewWithRelations = Prisma.ReviewGetPayload<{
      include: {
        user: {
          select: {
            firstName: true;
            lastName: true;
            email: true;
          };
        };
        media: {
          include: { media: true };
        };
      };
    }>;

    const reviews = (await this.prisma.review.findMany({
      where: { productId: product.id, status: ReviewStatus.APPROVED },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        media: {
          include: { media: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    })) as ReviewWithRelations[];

    return reviews.map((review) => ({
      id: review.id,
      productId: review.productId,
      userName:
        [review.user?.firstName, review.user?.lastName].filter(Boolean).join(" ").trim() ||
        review.user?.email ||
        "Lumi Customer",
      avatarUrl: null,
      rating: review.rating,
      title: review.title,
      content: review.content ?? null,
      isVerifiedPurchase: review.isVerifiedPurchase,
      helpfulCount: review.helpfulCount,
      notHelpfulCount: review.notHelpfulCount,
      createdAt: review.createdAt.toISOString(),
      media: review.media.map((entry) => ({
        id: entry.mediaId,
        url: entry.media.url,
        alt: entry.media.alt ?? null,
      })),
    }));
  }

  async listProductVariants(
    _productId: string,
    _options: { includeOutOfStock?: boolean } = {},
  ): Promise<ProductVariantSummary[]> {
    const productId = _productId.trim();
    const product = (await this.productRepository.findById(productId, {
      include: {
        variants: true,
      },
    })) as ProductEntityWithVariants | null;

    if (!product || product.deletedAt) {
      throw new NotFoundError("Product not found.", {
        details: { productId },
      });
    }

    const includeOutOfStock = _options.includeOutOfStock ?? true;
    const variants = await this.productRepository.listVariants(productId, {
      includeOutOfStock,
    });

    const priceDecimal =
      product.price instanceof Prisma.Decimal ? product.price : new Prisma.Decimal(product.price);
    const currency = product.currency ?? "TRY";

    return variants.map((variant) =>
      CatalogService.buildVariantSummary(variant, priceDecimal, currency),
    );
  }

  async createProduct(_input: ProductCreateRequestDTO): Promise<ProductSummaryDTO> {
    const input = _input;
    const currency = input.currency ?? input.price.currency;
    const slugBase = input.slug ?? input.title;
    const slug = await this.ensureUniqueProductSlug(slugBase);
    const searchKeywords = CatalogService.deriveKeywords(input);
    const variants = CatalogService.prepareVariantCreateInputs(input.variants, currency, slug);

    const data = {
      title: input.title,
      slug,
      summary: input.summary ?? null,
      description: input.description ?? null,
      status: input.status ?? ProductStatus.DRAFT,
      price: new Prisma.Decimal(input.price.amount),
      compareAtPrice: input.compareAtPrice
        ? new Prisma.Decimal(input.compareAtPrice.amount)
        : undefined,
      currency,
      inventoryPolicy: input.inventoryPolicy ?? InventoryPolicy.TRACK,
      searchKeywords,
      attributes: input.attributes ?? undefined,
      variants: {
        create: variants,
      },
      categories: {
        create: input.categoryIds.map((categoryId, index) => ({
          category: { connect: { id: categoryId } },
          isPrimary: index === 0,
        })),
      },
      productMedia: input.media
        ? {
            create: input.media.map((media, index) => ({
              media: { connect: { id: media.mediaId } },
              sortOrder: media.sortOrder ?? index + 1,
              isPrimary: media.isPrimary ?? index === 0,
            })),
          }
        : undefined,
    } satisfies Prisma.ProductCreateInput;

    const created = await this.productRepository.create({
      data,
      include: {
        variants: true,
        categories: { include: { category: true } },
        productMedia: { include: { media: true } },
      },
    });

    await this.cache.invalidateProductLists();
    await this.cache.invalidateCategoryTrees();
    await this.cache.invalidatePopularProducts();

    return mapProductToSummary(created as ProductWithRelations);
  }

  async updateProduct(_id: string, _input: ProductUpdateRequestDTO): Promise<ProductSummaryDTO> {
    const id = _id.trim();
    const existing = await this.productRepository.findById(id, {
      include: {
        variants: true,
        categories: { include: { category: true } },
        productMedia: { include: { media: true } },
      },
    });

    if (!existing || existing.deletedAt) {
      throw new NotFoundError("Product not found.", {
        details: { id },
      });
    }

    const input = _input;
    const currentSummary = mapProductToSummary(existing as ProductWithRelations);

    let slug: string | undefined;
    if (input.slug) {
      slug = await this.ensureUniqueProductSlug(input.slug, id);
    } else if (input.title && input.title !== existing.title) {
      slug = await this.ensureUniqueProductSlug(input.title, id);
    }

    let searchKeywords: string[] | undefined;
    if (input.searchKeywords) {
      searchKeywords = CatalogService.deriveKeywords(input, currentSummary);
    } else if (input.title !== undefined || input.summary !== undefined) {
      searchKeywords = CatalogService.deriveKeywords(
        { ...currentSummary, ...input },
        currentSummary,
      );
    }

    const updateData: Prisma.ProductUpdateInput = {};

    if (input.title !== undefined) updateData.title = input.title;
    if (slug) updateData.slug = slug;
    if (input.summary !== undefined) updateData.summary = input.summary ?? null;
    if (input.description !== undefined) updateData.description = input.description ?? null;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.price !== undefined) {
      updateData.price = new Prisma.Decimal(input.price.amount);
      if (input.currency === undefined) {
        updateData.currency = input.price.currency;
      }
    }
    if (input.compareAtPrice !== undefined) {
      updateData.compareAtPrice = input.compareAtPrice
        ? new Prisma.Decimal(input.compareAtPrice.amount)
        : null;
    }
    if (input.currency !== undefined) updateData.currency = input.currency;
    if (input.inventoryPolicy !== undefined) updateData.inventoryPolicy = input.inventoryPolicy;
    if (searchKeywords) updateData.searchKeywords = searchKeywords;
    if (input.attributes !== undefined) {
      updateData.attributes =
        input.attributes === null ? Prisma.JsonNull : (input.attributes as Prisma.InputJsonValue);
    }

    const { categoryIds } = input;

    const updated = await this.productRepository.withTransaction(async (repo, tx) => {
      const record = await repo.update({
        where: { id },
        data: updateData,
        include: {
          variants: true,
          categories: { include: { category: true } },
          productMedia: { include: { media: true } },
        },
      });

      if (categoryIds) {
        await tx.productCategory.deleteMany({ where: { productId: id } });
        await tx.productCategory.createMany({
          data: categoryIds.map((categoryId, index) => ({
            productId: id,
            categoryId,
            isPrimary: index === 0,
          })),
          skipDuplicates: true,
        });
      }

      return record;
    });

    await this.cache.invalidateProductLists();
    await this.cache.invalidateCategoryTrees();
    await this.cache.invalidatePopularProducts();

    const reloaded = await this.productRepository.findById(id, {
      include: {
        variants: true,
        categories: { include: { category: true } },
        productMedia: { include: { media: true } },
      },
    });

    return mapProductToSummary((reloaded ?? updated) as ProductWithRelations);
  }

  async archiveProduct(_id: string): Promise<void> {
    const id = _id.trim();
    const product = await this.productRepository.findById(id);
    if (!product || product.deletedAt) {
      throw new NotFoundError("Product not found.", {
        details: { id },
      });
    }

    const activeOrderCount = await this.productRepository.countActiveOrderReferences(id);
    if (activeOrderCount > 0) {
      throw new ConflictError("Product has active orders and cannot be archived.", {
        details: { id },
      });
    }

    await this.productRepository.withTransaction(async (repo, tx) => {
      await repo.update({
        where: { id },
        data: {
          status: ProductStatus.ARCHIVED,
          inventoryPolicy: InventoryPolicy.DENY,
        },
      });

      await repo.softDelete(id);

      await tx.productVariant.updateMany({
        where: { productId: id },
        data: { stock: 0 },
      });
    });

    await this.cache.invalidateProductLists();
    await this.cache.invalidateCategoryTrees();
    await this.cache.invalidatePopularProducts();
  }

  async addVariant(
    _productId: string,
    _input: ProductVariantInputDTO,
  ): Promise<ProductVariantSummary> {
    const productId = _productId.trim();
    const product = (await this.productRepository.findById(productId, {
      include: {
        variants: true,
      },
    })) as ProductEntityWithVariants | null;

    if (!product || product.deletedAt) {
      throw new NotFoundError("Product not found.", {
        details: { productId },
      });
    }

    const input = _input;
    const sku = (input.sku ?? `${product.slug}-${product.variants.length + 1}`).trim();

    const existingSku = await this.prisma.productVariant.findUnique({
      where: { sku },
      select: { id: true },
    });

    if (existingSku) {
      throw new ConflictError("Variant SKU already exists.", {
        details: { sku },
      });
    }

    CatalogService.validateVariantAttributes(
      product.attributes,
      (input.attributes ?? undefined) as Record<string, unknown> | null | undefined,
    );

    const price = new Prisma.Decimal(input.price.amount);
    const compareAt = input.compareAtPrice
      ? new Prisma.Decimal(input.compareAtPrice.amount)
      : undefined;
    const currency = product.currency ?? input.price.currency;

    const hasExistingVariants = product.variants.length > 0;
    const shouldBePrimary =
      input.isPrimary === undefined
        ? hasExistingVariants
          ? product.variants.every((variant) => variant.isPrimary === false)
          : true
        : input.isPrimary;

    const created = await this.productRepository.withTransaction(async (_repo, tx) => {
      const variant = await tx.productVariant.create({
        data: {
          productId,
          title: input.title,
          sku,
          price,
          compareAtPrice: compareAt,
          stock: input.stock ?? 0,
          attributes: input.attributes ?? undefined,
          weightGrams: input.weightGrams ?? undefined,
          isPrimary: shouldBePrimary,
        },
        include: {
          variantMedia: {
            include: { media: true },
          },
        },
      });

      if (shouldBePrimary && hasExistingVariants) {
        await tx.productVariant.updateMany({
          where: {
            productId,
            id: { not: variant.id },
          },
          data: { isPrimary: false },
        });
      }

      return variant;
    });

    await this.cache.invalidateProductLists();

    const productPrice =
      product.price instanceof Prisma.Decimal ? product.price : new Prisma.Decimal(product.price);

    return CatalogService.buildVariantSummary(created, productPrice, currency);
  }

  async updateVariant(
    _productId: string,
    _variantId: string,
    _input: ProductVariantUpdateDTO,
  ): Promise<ProductVariantSummary> {
    const productId = _productId.trim();
    const variantId = _variantId.trim();
    const input = _input;

    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: {
        product: true,
        variantMedia: { include: { media: true } },
      },
    });

    if (!variant || variant.productId !== productId || variant.product.deletedAt) {
      throw new NotFoundError("Variant not found.", {
        details: { productId, variantId },
      });
    }

    const { product } = variant;

    if (input.sku && input.sku !== variant.sku) {
      const duplicateSku = await this.prisma.productVariant.findUnique({
        where: { sku: input.sku },
        select: { id: true },
      });

      if (duplicateSku) {
        throw new ConflictError("Variant SKU already exists.", {
          details: { sku: input.sku },
        });
      }
    }

    if (input.stock !== undefined && input.stock < 0) {
      throw new ValidationError("Variant stock cannot be negative.", {
        issues: [
          {
            path: "stock",
            message: "Stock must be zero or greater.",
          },
        ],
      });
    }

    CatalogService.validateVariantAttributes(
      product.attributes,
      (input.attributes ?? undefined) as Record<string, unknown> | null | undefined,
    );

    const becomesPrimary = input.isPrimary === true;
    const removesPrimary = variant.isPrimary && input.isPrimary === false;

    if (removesPrimary) {
      const replacement = await this.prisma.productVariant.findFirst({
        where: {
          productId,
          id: { not: variantId },
        },
        orderBy: { createdAt: "asc" },
      });

      if (!replacement) {
        throw new ValidationError("At least one primary variant is required.", {
          issues: [
            {
              path: "isPrimary",
              message: "Cannot unset primary on the only variant.",
            },
          ],
        });
      }
    }

    const updated = await this.productRepository.withTransaction(async (_repo, tx) => {
      const data: Prisma.ProductVariantUpdateInput = {};

      if (input.title !== undefined) data.title = input.title;
      if (input.sku !== undefined) data.sku = input.sku;
      if (input.price !== undefined) data.price = new Prisma.Decimal(input.price.amount);
      if (input.compareAtPrice !== undefined) {
        data.compareAtPrice = input.compareAtPrice
          ? new Prisma.Decimal(input.compareAtPrice.amount)
          : null;
      }
      if (input.stock !== undefined) data.stock = input.stock;
      if (input.attributes !== undefined) {
        data.attributes =
          input.attributes === null ? Prisma.JsonNull : (input.attributes as Prisma.InputJsonValue);
      }
      if (input.weightGrams !== undefined) data.weightGrams = input.weightGrams ?? null;
      if (input.isPrimary !== undefined) data.isPrimary = input.isPrimary;

      const record = await tx.productVariant.update({
        where: { id: variantId },
        data,
        include: {
          variantMedia: { include: { media: true } },
        },
      });

      if (becomesPrimary) {
        await tx.productVariant.updateMany({
          where: {
            productId,
            id: { not: variantId },
          },
          data: { isPrimary: false },
        });
      } else if (removesPrimary) {
        const replacement = await tx.productVariant.findFirst({
          where: {
            productId,
            id: { not: variantId },
          },
          orderBy: { createdAt: "asc" },
        });

        if (replacement) {
          await tx.productVariant.update({
            where: { id: replacement.id },
            data: { isPrimary: true },
          });
        }
      }

      return record;
    });

    await this.cache.invalidateProductLists();

    const priceDecimal =
      product.price instanceof Prisma.Decimal ? product.price : new Prisma.Decimal(product.price);
    const currency = product.currency ?? input.price?.currency ?? "TRY";

    return CatalogService.buildVariantSummary(updated, priceDecimal, currency);
  }

  async deleteVariant(_productId: string, _variantId: string): Promise<void> {
    const productId = _productId.trim();
    const variantId = _variantId.trim();

    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { product: true },
    });

    if (!variant || variant.productId !== productId || variant.product.deletedAt) {
      throw new NotFoundError("Variant not found.", {
        details: { productId, variantId },
      });
    }

    if (variant.isPrimary) {
      throw new ConflictError("Primary variant cannot be deleted.", {
        details: { variantId },
      });
    }

    await this.prisma.productVariant.delete({ where: { id: variantId } });

    await this.cache.invalidateProductLists();
    await this.cache.invalidatePopularProducts();
  }

  async listPopularProducts(
    options: { limit?: number; refreshCache?: boolean } = {},
  ): Promise<ProductSummaryDTO[]> {
    const limit = Math.min(Math.max(options.limit ?? 12, 1), 50);
    const cacheKey = stableStringify({ scope: "popular", limit });

    if (!options.refreshCache) {
      const cached = await this.cache.getPopularProducts(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const products = await this.productRepository.listPopularProducts(limit);
    const summaries = products.map((product) =>
      mapProductToSummary(product as ProductWithRelations),
    );
    await this.cache.setPopularProducts(cacheKey, summaries);
    return summaries;
  }

  async listCategories(
    options: { depth?: number; refresh?: boolean } = {},
  ): Promise<CategoryTreeNode[]> {
    const depth = options.depth ?? DEFAULT_CATEGORY_DEPTH;
    const cacheKey = stableStringify({ scope: "categories", depth });

    if (!options.refresh) {
      const cached = await this.cache.getCategoryTree(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const hierarchy = await this.categoryRepository.getHierarchy();
    const categoryIds = new Set<string>();
    this.collectCategoryNodeIds(hierarchy, categoryIds);
    const counts = await this.fetchProductCounts(categoryIds);
    const tree = hierarchy.map((node) => this.mapCategoryNode(node, counts));
    const limited = this.limitCategoryDepth(tree, depth);
    await this.cache.setCategoryTree(cacheKey, limited);
    return limited;
  }

  async getCategoryDetail(
    _slug: string,
    _options: { page?: number; perPage?: number } = {},
  ): Promise<CategoryDetailResult> {
    const slug = _slug.trim();
    const category = await this.categoryRepository.findBySlug(slug);

    if (!category) {
      throw new NotFoundError("Category not found.", {
        details: { slug },
      });
    }

    const page = _options.page ?? 1;
    const perPage = _options.perPage ?? 24;

    const [children, breadcrumbs, products] = await Promise.all([
      this.categoryRepository.getChildren(category.id),
      this.categoryRepository.getBreadcrumbs(category.id),
      this.productService.search({
        filter: {
          categoryIds: [category.id],
          statuses: ["ACTIVE"],
        },
        pagination: {
          page,
          pageSize: perPage,
        },
      }),
    ]);

    return {
      category: CatalogService.toCategorySummary(category),
      subcategories: children.map((child) => CatalogService.toCategorySummary(child)),
      breadcrumbs: breadcrumbs.map((crumb) => CatalogService.toCategorySummary(crumb)),
      products,
    };
  }

  async createCategory(_input: CategoryCreateRequestDTO): Promise<CategorySummaryDTO> {
    const input = _input;
    const slugBase = input.slug ?? input.name;
    const slug = await this.ensureUniqueCategorySlug(slugBase);

    let parent: Category | null = null;
    if (input.parentId) {
      parent = await this.prisma.category.findUnique({ where: { id: input.parentId } });
      if (!parent) {
        throw new ValidationError("Parent category does not exist.", {
          issues: [
            {
              path: "parentId",
              message: "Referenced parent category could not be found.",
            },
          ],
        });
      }
    }

    const level = parent ? parent.level + 1 : 0;
    const path = parent ? `${parent.path}/${slug}`.replaceAll(/\/+/gu, "/") : `/${slug}`;

    const created = await this.categoryRepository.create({
      data: {
        name: input.name,
        slug,
        description: input.description ?? null,
        imageUrl: input.imageUrl ?? null,
        iconUrl: input.iconUrl ?? null,
        displayOrder: input.displayOrder ?? null,
        level,
        path,
        parent: parent ? { connect: { id: parent.id } } : undefined,
      },
    });

    await this.cache.invalidateCategoryTrees();

    return CatalogService.toCategorySummary(created);
  }

  async updateCategory(_id: string, _input: CategoryUpdateRequestDTO): Promise<CategorySummaryDTO> {
    const id = _id.trim();
    const existing = await this.prisma.category.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundError("Category not found.", {
        details: { id },
      });
    }

    const input = _input;

    let parent: Category | null = existing.parentId
      ? await this.prisma.category.findUnique({ where: { id: existing.parentId } })
      : null;

    if (input.parentId !== undefined) {
      if (input.parentId === null) {
        parent = null;
      } else {
        if (input.parentId === id) {
          throw new ValidationError("Category cannot be its own parent.", {
            issues: [
              {
                path: "parentId",
                message: "Parent category cannot match the category itself.",
              },
            ],
          });
        }

        const candidateParent = await this.prisma.category.findUnique({
          where: { id: input.parentId },
        });

        if (!candidateParent) {
          throw new ValidationError("Parent category does not exist.", {
            issues: [
              {
                path: "parentId",
                message: "Referenced parent category could not be found.",
              },
            ],
          });
        }

        if (candidateParent.path.startsWith(`${existing.path}/`)) {
          throw new ValidationError("Cannot move category under its descendant.", {
            issues: [
              {
                path: "parentId",
                message: "Parent category cannot be a descendant of the category.",
              },
            ],
          });
        }

        parent = candidateParent;
      }
    }

    const slugBase =
      input.slug ?? (input.name && input.name !== existing.name ? input.name : existing.slug);
    const slug = await this.ensureUniqueCategorySlug(slugBase, id);

    const level = parent ? parent.level + 1 : 0;
    const path = parent ? `${parent.path}/${slug}`.replaceAll(/\/+/gu, "/") : `/${slug}`;

    const updateData: Prisma.CategoryUpdateInput = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (slug !== existing.slug) updateData.slug = slug;
    if (input.description !== undefined) updateData.description = input.description ?? null;
    if (input.imageUrl !== undefined) updateData.imageUrl = input.imageUrl ?? null;
    if (input.iconUrl !== undefined) updateData.iconUrl = input.iconUrl ?? null;
    if (input.displayOrder !== undefined) updateData.displayOrder = input.displayOrder ?? null;
    updateData.level = level;
    updateData.path = path;
    updateData.parent = parent ? { connect: { id: parent.id } } : { disconnect: true };

    const updated = await this.prisma.category.update({
      where: { id },
      data: updateData,
    });

    await this.categoryRepository.updateDescendantPaths(id, path, level);
    await this.cache.invalidateCategoryTrees();
    await this.cache.invalidateProductLists();
    await this.cache.invalidatePopularProducts();

    const reloaded = await this.prisma.category.findUnique({ where: { id } });
    return CatalogService.toCategorySummary(reloaded ?? updated);
  }

  async deleteCategory(_id: string): Promise<void> {
    const id = _id.trim();
    const category = await this.prisma.category.findUnique({ where: { id } });

    if (!category) {
      throw new NotFoundError("Category not found.", {
        details: { id },
      });
    }

    const childCount = await this.prisma.category.count({ where: { parentId: id } });
    if (childCount > 0) {
      throw new ConflictError("Category has child categories and cannot be deleted.", {
        details: { id },
      });
    }

    const productUsage = await this.prisma.productCategory.count({
      where: {
        categoryId: id,
        product: {
          status: ProductStatus.ACTIVE,
          deletedAt: null,
        },
      },
    });

    if (productUsage > 0) {
      throw new ConflictError("Category contains active products and cannot be deleted.", {
        details: { id },
      });
    }

    await this.prisma.category.delete({ where: { id } });

    await this.cache.invalidateCategoryTrees();
    await this.cache.invalidateProductLists();
    await this.cache.invalidatePopularProducts();
  }

  private limitCategoryDepth(nodes: CategoryTreeNode[], depth: number): CategoryTreeNode[] {
    if (depth <= 0) {
      return [];
    }

    return nodes.map((node) => ({
      ...node,
      children: this.limitCategoryDepth(node.children, depth - 1),
    }));
  }

  private async ensureUniqueProductSlug(base: string, ignoreId?: string): Promise<string> {
    const normalised = generateSlug(base);
    if (!normalised) {
      throw new ValidationError("Unable to generate product slug.", {
        issues: [
          {
            path: "slug",
            message: "A valid slug could not be generated.",
          },
        ],
      });
    }

    const findUnique = async (suffix = 0): Promise<string> => {
      const candidate = suffix === 0 ? normalised : `${normalised}-${suffix}`;
      const existing = await this.productRepository.findBySlug(candidate, {
        select: { id: true },
      });

      if (!existing || (ignoreId && existing.id === ignoreId)) {
        return candidate;
      }

      return findUnique(suffix + 1);
    };

    return findUnique();
  }

  private async ensureUniqueCategorySlug(base: string, ignoreId?: string): Promise<string> {
    const normalised = generateSlug(base);
    if (!normalised) {
      throw new ValidationError("Unable to generate category slug.", {
        issues: [
          {
            path: "slug",
            message: "A valid slug could not be generated.",
          },
        ],
      });
    }

    const findUnique = async (suffix = 0): Promise<string> => {
      const candidate = suffix === 0 ? normalised : `${normalised}-${suffix}`;
      const existing = await this.categoryRepository.findBySlug(candidate);
      if (!existing || (ignoreId && existing.id === ignoreId)) {
        return candidate;
      }

      return findUnique(suffix + 1);
    };

    return findUnique();
  }

  private static deriveKeywords(
    input: ProductCreateRequestDTO | ProductUpdateRequestDTO,
    current?: ProductSummaryDTO,
  ): string[] {
    const baseTitle = input.title ?? current?.title ?? "";
    const summary = input.summary ?? current?.summary ?? null;
    const explicit = input.searchKeywords ?? current?.searchKeywords ?? [];
    return deriveSearchKeywords(baseTitle, summary, explicit);
  }

  private collectCategoryNodeIds(nodes: CategoryNode[], accumulator: Set<string>): void {
    nodes.forEach((node) => {
      accumulator.add(node.id);
      if (node.children.length > 0) {
        this.collectCategoryNodeIds(node.children as CategoryNode[], accumulator);
      }
    });
  }

  private static normalisePositiveInteger(value: unknown, fallback: number, minimum = 1): number {
    if (typeof value === "number" && Number.isFinite(value)) {
      const normalised = Math.trunc(value);
      return normalised >= minimum ? normalised : fallback;
    }

    if (typeof value === "string") {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed) && parsed >= minimum) {
        return parsed;
      }
    }

    return fallback;
  }

  private static buildEmptyProductResult(
    pagination: Record<string, unknown>,
  ): PaginatedResult<ProductSummaryDTO> {
    const page = CatalogService.normalisePositiveInteger(pagination.page, 1);
    const pageSize = CatalogService.normalisePositiveInteger(pagination.pageSize, 24);

    return {
      items: [],
      meta: {
        totalItems: 0,
        totalPages: 0,
        page,
        pageSize,
        hasNextPage: false,
        hasPreviousPage: page > 1,
      },
    };
  }

  private static normaliseAttributes(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
  }

  private async fetchProductCounts(categoryIds: Set<string>): Promise<Map<string, number>> {
    if (categoryIds.size === 0) {
      return new Map();
    }

    const result = await this.prisma.productCategory.groupBy({
      by: ["categoryId"],
      _count: { categoryId: true },
      where: {
        categoryId: { in: [...categoryIds] },
        product: {
          status: ProductStatus.ACTIVE,
          deletedAt: null,
        },
      },
    });

    const counts = new Map<string, number>();
    result.forEach(({ categoryId, _count: countData }) => {
      counts.set(categoryId, countData.categoryId);
    });

    return counts;
  }

  private async calculateReviewSummary(productId: string): Promise<ReviewSummary> {
    const [aggregate, breakdown] = await Promise.all([
      this.prisma.review.aggregate({
        where: { productId, status: ReviewStatus.APPROVED },
        _avg: { rating: true },
        _count: { rating: true },
      }),
      this.prisma.review.groupBy({
        by: ["rating"],
        _count: { rating: true },
        where: { productId, status: ReviewStatus.APPROVED },
      }),
    ]);

    const { _count: countResult, _avg: averageResult } = aggregate;
    const totalReviews = countResult?.rating ?? 0;
    const rawAverage = averageResult?.rating ?? null;
    let averageRating = 0;

    if (rawAverage !== null && rawAverage !== undefined) {
      const decimalValue =
        typeof rawAverage === "number"
          ? new Prisma.Decimal(rawAverage)
          : (rawAverage as Prisma.Decimal);
      averageRating = Number(decimalValue.toFixed(2));
    }

    const ratingBreakdown = Object.fromEntries(
      breakdown.map(({ rating, _count: countData }) => [rating, countData.rating]),
    ) as Record<number, number>;

    return {
      totalReviews,
      averageRating,
      ratingBreakdown,
    };
  }

  private static buildVariantSummary(
    variant: Awaited<ReturnType<ProductRepository["listVariants"]>>[number],
    productPrice: Prisma.Decimal,
    currency: string,
  ): ProductVariantSummary {
    const priceDecimal =
      variant.price instanceof Prisma.Decimal ? variant.price : new Prisma.Decimal(variant.price);
    const compareDecimal =
      variant.compareAtPrice instanceof Prisma.Decimal || variant.compareAtPrice === null
        ? variant.compareAtPrice
        : new Prisma.Decimal(variant.compareAtPrice ?? 0);

    const delta = priceDecimal.minus(productPrice);
    const priceDifference = delta.isZero() === false ? formatMoney(delta, currency) : undefined;

    return {
      id: variant.id,
      title: variant.title,
      sku: variant.sku,
      price: formatMoney(priceDecimal, currency),
      compareAtPrice: compareDecimal ? formatMoney(compareDecimal, currency) : undefined,
      priceDifference,
      stock: variant.stock,
      isPrimary: variant.isPrimary,
      availability: determineAvailability(variant.stock),
      attributes: CatalogService.normaliseAttributes(variant.attributes),
      media: variant.variantMedia.map((entry) => ({
        id: entry.media.id,
        url: entry.media.url,
        type: entry.media.type,
        alt: entry.media.alt ?? null,
        sortOrder: entry.sortOrder ?? null,
        isPrimary: entry.isPrimary,
      })),
    };
  }

  private static validateVariantAttributes(
    productAttributes: unknown,
    variantAttributes: Record<string, unknown> | null | undefined,
  ): void {
    if (!productAttributes || typeof productAttributes !== "object" || !variantAttributes) {
      return;
    }

    const attributeDefinitions = new Map(
      Object.entries(productAttributes as Record<string, unknown>),
    );

    Object.entries(variantAttributes).forEach(([key, value]) => {
      const definition = attributeDefinitions.get(key);
      if (Array.isArray(definition) && !definition.includes(value)) {
        throw new ValidationError("Variant attribute value is not permitted for this product.", {
          issues: [
            {
              path: `attributes.${key}`,
              message: "Value is not allowed for this attribute.",
            },
          ],
        });
      }
    });
  }

  private mapCategoryNode(node: CategoryNode, counts: Map<string, number>): CategoryTreeNode {
    return {
      id: node.id,
      name: node.name,
      slug: node.slug,
      description: node.description ?? null,
      parentId: node.parentId ?? null,
      level: node.level,
      path: node.path,
      imageUrl: node.imageUrl ?? null,
      iconUrl: node.iconUrl ?? null,
      displayOrder: node.displayOrder ?? null,
      createdAt: node.createdAt.toISOString(),
      updatedAt: node.updatedAt.toISOString(),
      productCount: counts.get(node.id) ?? 0,
      children: (node.children as CategoryNode[]).map((child) =>
        this.mapCategoryNode(child, counts),
      ),
    };
  }

  private static prepareVariantCreateInputs(
    variants: ProductVariantInputDTO[],
    currency: string,
    slug: string,
  ): Prisma.ProductVariantCreateWithoutProductInput[] {
    if (variants.length === 0) {
      throw new ValidationError("At least one product variant is required.", {
        issues: [
          {
            path: "variants",
            message: "Provide at least one variant.",
          },
        ],
      });
    }

    const seenSkus = new Set<string>();

    const prepared = variants.map((variant, index) => {
      const resolvedSku = (variant.sku ?? `${slug}-${index + 1}`).trim();
      if (seenSkus.has(resolvedSku)) {
        throw new ValidationError("Duplicate variant SKU detected.", {
          issues: [
            {
              path: `variants.${index}.sku`,
              message: "Each variant must have a unique SKU.",
            },
          ],
        });
      }
      seenSkus.add(resolvedSku);

      const priceDecimal = new Prisma.Decimal(variant.price.amount);
      const compareDecimal = variant.compareAtPrice
        ? new Prisma.Decimal(variant.compareAtPrice.amount)
        : undefined;

      return {
        title: variant.title,
        sku: resolvedSku,
        price: priceDecimal,
        compareAtPrice: compareDecimal,
        stock: variant.stock ?? 0,
        attributes: variant.attributes ?? undefined,
        weightGrams: variant.weightGrams ?? undefined,
        isPrimary: variant.isPrimary ?? false,
      } satisfies Prisma.ProductVariantCreateWithoutProductInput;
    });

    const hasPrimaryVariant = prepared.some((variant) => variant.isPrimary);
    if (hasPrimaryVariant) {
      return prepared;
    }

    const [firstVariant] = prepared;
    if (firstVariant) {
      firstVariant.isPrimary = true;
    }

    return prepared;
  }

  private static toCategorySummary(category: Category): CategorySummaryDTO {
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description ?? null,
      parentId: category.parentId ?? null,
      level: category.level,
      path: category.path,
      imageUrl: category.imageUrl ?? null,
      iconUrl: category.iconUrl ?? null,
      displayOrder: category.displayOrder ?? null,
      createdAt: category.createdAt.toISOString(),
      updatedAt: category.updatedAt.toISOString(),
    };
  }
}
