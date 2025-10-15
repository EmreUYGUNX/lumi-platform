/* eslint-disable import/order */
import { Prisma } from "@prisma/client";
import type { ZodError } from "zod";

import {
  type PaginationRequest,
  type ProductFilter,
  type ProductSummaryDTO,
  type ProductWithRelations,
  mapProductToSummary,
  paginationRequestSchema,
  productFilterSchema,
} from "@lumi/shared/dto";

import { NotFoundError, ValidationError } from "@/lib/errors.js";
import type { PaginatedResult, PaginationOptions } from "@/lib/repository/base.repository.js";

/* eslint-disable unicorn/no-null */
import type { ProductSearchFilters } from "./product.repository.js";

interface ProductRepositoryLike {
  findBySlug(
    slug: string,
    options?: {
      include?: Prisma.ProductInclude;
      select?: Prisma.ProductSelect;
    },
  ): Promise<Prisma.ProductGetPayload<{ include: Prisma.ProductInclude }> | null>;
  search(
    filters: ProductSearchFilters,
    pagination?: Omit<
      PaginationOptions<
        Prisma.ProductWhereInput,
        Prisma.ProductOrderByWithRelationInput,
        Prisma.ProductSelect,
        Prisma.ProductInclude
      >,
      "where"
    >,
  ): Promise<PaginatedResult<Prisma.ProductGetPayload<{ include: Prisma.ProductInclude }>>>;
}

const DEFAULT_PRODUCT_INCLUDE: Prisma.ProductInclude = {
  variants: true,
  categories: {
    include: { category: true },
  },
  productMedia: {
    include: { media: true },
  },
};

const parseBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    if (value.trim().toLowerCase() === "true") {
      return true;
    }

    if (value.trim().toLowerCase() === "false") {
      return false;
    }
  }

  return undefined;
};

const toNullableString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const toStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter((entry) => entry.length > 0);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  return [];
};

const toDecimalString = (value: unknown): string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toFixed(2);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  return undefined;
};

const normaliseStatuses = (raw: Record<string, unknown>): string[] =>
  toStringArray(raw.statuses ?? raw.status).map((status) => status.toUpperCase());

const buildPriceRangeInput = (
  raw: Record<string, unknown>,
): { min?: string; max?: string } | undefined => {
  const min = toDecimalString(raw.priceMin ?? raw.minPrice);
  const max = toDecimalString(raw.priceMax ?? raw.maxPrice);

  const range: { min?: string; max?: string } = {};

  if (min) {
    range.min = min;
  }

  if (max) {
    range.max = max;
  }

  return Object.keys(range).length > 0 ? range : undefined;
};

const coerceQuery = (input: unknown): Record<string, unknown> =>
  input && typeof input === "object" ? (input as Record<string, unknown>) : {};

const parseWithValidation = <T>(
  schema: {
    safeParse(input: unknown): { success: true; data: T } | { success: false; error: ZodError<T> };
  },
  input: unknown,
  message: string,
): T => {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError(message, {
      details: {
        issues: result.error.issues,
      },
    });
  }

  return result.data;
};

const resolveSearchFilter = (raw: Record<string, unknown>): Record<string, unknown> => {
  const search = toNullableString(raw.search ?? raw.term);
  return search ? { search } : {};
};

const resolveStatusFilter = (raw: Record<string, unknown>): Record<string, unknown> => {
  const statuses = normaliseStatuses(raw);
  return statuses.length > 0 ? { statuses } : {};
};

const resolveCategoryFilter = (raw: Record<string, unknown>): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  const categoryIds = toStringArray(raw.categoryIds ?? raw.categoryId);
  if (categoryIds.length > 0) {
    result.categoryIds = categoryIds;
  }

  const primaryCategoryId = toNullableString(raw.primaryCategoryId);
  if (primaryCategoryId) {
    result.primaryCategoryId = primaryCategoryId;
  }

  return result;
};

const resolveCollectionFilter = (raw: Record<string, unknown>): Record<string, unknown> => {
  const collectionIds = toStringArray(raw.collectionIds ?? raw.collectionId);
  return collectionIds.length > 0 ? { collectionIds } : {};
};

const resolvePriceRangeFilter = (raw: Record<string, unknown>): Record<string, unknown> => {
  const priceRange = buildPriceRangeInput(raw);
  return priceRange ? { priceRange } : {};
};

const resolveIncludeDeletedFilter = (raw: Record<string, unknown>): Record<string, unknown> => {
  const includeDeleted = parseBoolean(raw.includeDeleted);

  if (includeDeleted === undefined) {
    return {};
  }

  return { includeDeleted };
};

const resolveInventoryAvailabilityFilter = (
  raw: Record<string, unknown>,
): Record<string, unknown> => {
  const availability = toNullableString(raw.inventoryAvailability ?? raw.stock);
  return availability ? { inventoryAvailability: availability } : {};
};

const resolveSortFilter = (raw: Record<string, unknown>): Record<string, unknown> => {
  const sort = toNullableString(raw.sort ?? raw.order);
  return sort ? { sort } : {};
};

const resolveCursorFilter = (raw: Record<string, unknown>): Record<string, unknown> => {
  const cursor = toNullableString(raw.cursor);
  return cursor ? { cursor } : {};
};

const resolveTakeFilter = (raw: Record<string, unknown>): Record<string, unknown> => {
  if (raw.take === undefined) {
    return {};
  }

  return { take: raw.take };
};

const buildFilterInput = (raw: Record<string, unknown>): Record<string, unknown> => ({
  ...resolveSearchFilter(raw),
  ...resolveStatusFilter(raw),
  ...resolveCategoryFilter(raw),
  ...resolveCollectionFilter(raw),
  ...resolvePriceRangeFilter(raw),
  ...resolveIncludeDeletedFilter(raw),
  ...resolveInventoryAvailabilityFilter(raw),
  ...resolveSortFilter(raw),
  ...resolveCursorFilter(raw),
  ...resolveTakeFilter(raw),
});

const buildPaginationInput = (raw: Record<string, unknown>): Record<string, unknown> => {
  const pagination: Record<string, unknown> = {};

  if (raw.page !== undefined) {
    pagination.page = raw.page;
  }

  if (raw.pageSize !== undefined) {
    pagination.pageSize = raw.pageSize;
  }

  return pagination;
};

const parseFilterInput = (input: unknown): ProductFilter => {
  if (productFilterSchema.safeParse(input).success) {
    return input as ProductFilter;
  }

  const raw = coerceQuery(input ?? {});
  const filterInput = buildFilterInput(raw);
  return parseWithValidation(productFilterSchema, filterInput, "Invalid product filter.");
};

const parsePaginationInput = (input: unknown): PaginationRequest => {
  if (paginationRequestSchema.safeParse(input).success) {
    return input as PaginationRequest;
  }

  const raw = coerceQuery(input ?? {});
  const paginationInput = buildPaginationInput(raw);
  return parseWithValidation(
    paginationRequestSchema,
    paginationInput,
    "Invalid pagination parameters.",
  );
};

const extractSearchParameters = (
  input: unknown,
): {
  filter: ProductFilter;
  pagination: PaginationRequest;
} => {
  if (input && typeof input === "object" && "filter" in (input as Record<string, unknown>)) {
    const { filter, pagination } = input as { filter?: unknown; pagination?: unknown };
    return {
      filter: parseFilterInput(filter ?? {}),
      pagination: parsePaginationInput(pagination ?? {}),
    };
  }

  const query = coerceQuery(input ?? {});

  if (query.cursor !== undefined || query.take !== undefined) {
    throw new ValidationError("Cursor-based pagination is not supported for this endpoint yet.");
  }

  return {
    filter: parseFilterInput(query),
    pagination: parsePaginationInput(query),
  };
};

const toRepositoryFilters = (filter: ProductFilter): ProductSearchFilters => {
  const filters: ProductSearchFilters = {};

  if (filter.search) {
    filters.term = filter.search;
  }

  if (filter.statuses) {
    filters.statuses = filter.statuses;
  }

  if (filter.categoryIds) {
    filters.categoryIds = filter.categoryIds;
  }

  if (filter.primaryCategoryId) {
    filters.primaryCategoryId = filter.primaryCategoryId;
  }

  if (filter.collectionIds) {
    filters.collectionIds = filter.collectionIds;
  }

  if (filter.priceRange?.min) {
    filters.minPrice = new Prisma.Decimal(filter.priceRange.min);
  }

  if (filter.priceRange?.max) {
    filters.maxPrice = new Prisma.Decimal(filter.priceRange.max);
  }

  if (filter.includeDeleted !== undefined) {
    filters.includeDeleted = filter.includeDeleted;
  }

  return filters;
};

const mapSortToOrderBy = (
  sort: ProductFilter["sort"],
): Prisma.ProductOrderByWithRelationInput[] | undefined => {
  switch (sort) {
    case "newest": {
      return [{ createdAt: "desc" }];
    }
    case "oldest": {
      return [{ createdAt: "asc" }];
    }
    case "price_asc": {
      return [{ price: "asc" }];
    }
    case "price_desc": {
      return [{ price: "desc" }];
    }
    case "title_asc": {
      return [{ title: "asc" }];
    }
    case "title_desc": {
      return [{ title: "desc" }];
    }
    default: {
      return undefined;
    }
  }
};

export type ProductSearchResult = PaginatedResult<ProductSummaryDTO>;

export class ProductService {
  private readonly repository: ProductRepositoryLike;

  constructor(repository: ProductRepositoryLike) {
    this.repository = repository;
  }

  async search(input: unknown): Promise<ProductSearchResult> {
    const { filter, pagination } = extractSearchParameters(input);

    const filters = toRepositoryFilters(filter);
    const orderBy = mapSortToOrderBy(filter.sort);

    const result = await this.repository.search(filters, {
      page: pagination.page,
      pageSize: pagination.pageSize,
      orderBy,
      include: DEFAULT_PRODUCT_INCLUDE,
    });

    return {
      items: result.items.map((product) => mapProductToSummary(product as ProductWithRelations)),
      meta: result.meta,
    };
  }

  async getBySlug(slug: string): Promise<ProductSummaryDTO> {
    const product = await this.repository.findBySlug(slug, { include: DEFAULT_PRODUCT_INCLUDE });

    if (product) {
      return mapProductToSummary(product);
    }

    throw new NotFoundError("Product not found.", {
      details: { slug },
    });
  }
}

/* eslint-enable unicorn/no-null */
