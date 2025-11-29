import type { ProductListFilters } from "../types/product.types";

const normalizeAttributes = (
  attributes: ProductListFilters["attributes"],
): ProductListFilters["attributes"] => {
  if (!attributes) {
    return undefined;
  }

  const sortedEntries = Object.entries(attributes)
    .filter(([, value]) => value && value.length > 0)
    .map(([key, value]) => [key, [...new Set(value as string[])].sort()] as const)
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));

  if (sortedEntries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(sortedEntries) as Record<string, string[]>;
};

const normalizeKeyFilters = (filters: ProductListFilters = {}) => {
  const normalized: ProductListFilters = {};

  if (typeof filters.page === "number") {
    normalized.page = filters.page;
  }
  if (typeof filters.pageSize === "number") {
    normalized.pageSize = filters.pageSize;
  }
  if (filters.search) {
    normalized.search = filters.search;
  }
  if (filters.tags?.length) {
    normalized.tags = [...new Set(filters.tags)].sort();
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
  if (filters.priceRange) {
    normalized.priceRange = {
      min: filters.priceRange.min,
      max: filters.priceRange.max,
    };
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

export const productKeys = {
  all: () => ["products"] as const,
  lists: () => [...productKeys.all(), "list"] as const,
  list: (filters: ProductListFilters = {}) => [
    ...productKeys.lists(),
    normalizeKeyFilters(filters),
  ],
  detail: (slug: string) => [...productKeys.all(), "detail", slug] as const,
  search: (term: string) => [...productKeys.all(), "search", term.trim().toLowerCase()] as const,
};
