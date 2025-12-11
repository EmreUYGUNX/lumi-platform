import { z } from "zod";

import { isoDateTimeSchema, paginationMetaSchema } from "@lumi/shared/dto";

import type {
  ProductAttributeFilters,
  ProductListFilters,
  ProductPriceRangeFilter,
} from "../types/product.types";

export const cursorMetaSchema = z
  .object({
    hasMore: z.boolean(),
    next: z.string().optional(),
  })
  .strict()
  .optional();

export const paginatedMetaSchema = z
  .object({
    pagination: paginationMetaSchema,
    cursor: cursorMetaSchema,
    timestamp: isoDateTimeSchema.optional(),
    requestId: z.string().optional(),
  })
  .strip();

export const FALLBACK_PAGINATION = {
  page: 1,
  pageSize: 0,
  totalItems: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPreviousPage: false,
};

const formatDecimal = (value: number | undefined): string | undefined => {
  if (value === undefined || Number.isNaN(value)) {
    return undefined;
  }

  return value.toFixed(2);
};

const normalizePriceRange = (
  priceRange: ProductPriceRangeFilter | undefined,
): ProductPriceRangeFilter | undefined => {
  if (!priceRange) {
    return undefined;
  }

  const nextRange: ProductPriceRangeFilter = {};
  if (priceRange.min !== undefined) {
    nextRange.min = priceRange.min;
  }
  if (priceRange.max !== undefined) {
    nextRange.max = priceRange.max;
  }

  return Object.keys(nextRange).length > 0 ? nextRange : undefined;
};

const normalizeAttributes = (
  attributes: ProductAttributeFilters | undefined,
): ProductAttributeFilters | undefined => {
  if (!attributes) {
    return undefined;
  }

  const filtered = Object.entries(attributes)
    .filter(([, value]) => value && value.length > 0)
    .map(([key, value]) => [key, [...new Set(value as string[])].sort()] as const)
    .sort(([left], [right]) => left.localeCompare(right));

  if (filtered.length === 0) {
    return undefined;
  }

  return Object.fromEntries(filtered) as ProductAttributeFilters;
};

export const normalizeProductFilters = (filters: ProductListFilters = {}): ProductListFilters => {
  const normalized: ProductListFilters = {};

  if (typeof filters.page === "number") {
    normalized.page = filters.page;
  }

  if (typeof filters.pageSize === "number") {
    normalized.pageSize = filters.pageSize;
  }

  if (filters.search) {
    normalized.search = filters.search.trim();
  }

  if (filters.tags?.length) {
    normalized.tags = [...new Set(filters.tags.map((tag) => tag.trim()))].filter(Boolean).sort();
  }

  if (filters.categoryId) {
    normalized.categoryId = filters.categoryId;
  }

  if (filters.categorySlug) {
    normalized.categorySlug = filters.categorySlug;
  }

  if (filters.sort) {
    normalized.sort = filters.sort;
  }

  if (filters.cursor) {
    normalized.cursor = filters.cursor;
  }

  if (filters.statuses?.length) {
    normalized.statuses = [...new Set(filters.statuses)].sort();
  }

  const priceRange = normalizePriceRange(filters.priceRange);
  if (priceRange) {
    normalized.priceRange = priceRange;
  }

  const normalizedAttributes = normalizeAttributes(filters.attributes);
  if (normalizedAttributes) {
    normalized.attributes = normalizedAttributes;
  }

  if (filters.inventoryAvailability) {
    normalized.inventoryAvailability = filters.inventoryAvailability;
  }

  if (filters.brands?.length) {
    normalized.brands = [...new Set(filters.brands)].sort();
  }

  if (typeof filters.rating === "number") {
    normalized.rating = filters.rating;
  }

  return normalized;
};

export const buildProductQuery = (filters: ProductListFilters = {}) => {
  const query: Record<string, string | number | boolean | string[] | undefined> = {};
  const baseEntries: [string, string | number | boolean | string[] | undefined][] = [
    ["page", filters.page],
    ["perPage", filters.pageSize],
    ["search", filters.search],
    ["tags", filters.tags],
    ["categoryId", filters.categoryId],
    ["categorySlug", filters.categorySlug],
    ["sort", filters.sort],
    ["cursor", filters.cursor],
    ["statuses", filters.statuses],
  ];

  baseEntries.forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      // eslint-disable-next-line security/detect-object-injection
      query[key] = value;
    }
  });

  if (filters.priceRange?.min !== undefined) {
    const min = formatDecimal(filters.priceRange.min);
    if (min) {
      query.priceMin = min;
    }
  }

  if (filters.priceRange?.max !== undefined) {
    const max = formatDecimal(filters.priceRange.max);
    if (max) {
      query.priceMax = max;
    }
  }

  if (filters.inventoryAvailability) {
    query.inventoryAvailability = filters.inventoryAvailability;
  }

  const normalizedAttributes = normalizeAttributes(filters.attributes);
  const attributeFilters: ProductAttributeFilters = normalizedAttributes
    ? { ...normalizedAttributes }
    : {};

  if (filters.brands?.length) {
    attributeFilters.brand = [...new Set(filters.brands)].sort();
  }

  if (filters.rating) {
    attributeFilters.rating = [`${filters.rating}+`];
  }

  if (Object.keys(attributeFilters).length > 0) {
    query.attributes = JSON.stringify(attributeFilters);
  }

  return query;
};
