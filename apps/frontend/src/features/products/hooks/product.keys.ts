import type { ProductListFilters } from "../types/product.types";

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
};
