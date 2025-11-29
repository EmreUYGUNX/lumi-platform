import { useMemo } from "react";

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { paginationMetaSchema, productSummarySchema } from "@lumi/shared/dto";
import { apiClient } from "@/lib/api-client";

import type { ProductListFilters, ProductListResult } from "../types/product.types";
import { productKeys } from "./product.keys";

const productListSchema = z.array(productSummarySchema);
const paginatedMetaSchema = z
  .object({
    pagination: paginationMetaSchema,
    cursor: z.string().optional(),
  })
  .strict();

const normalizeFilters = (filters: ProductListFilters = {}): ProductListFilters => {
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

  return normalized;
};

const buildQuery = (filters: ProductListFilters = {}) => {
  const query: Record<string, string | number | boolean | string[] | undefined> = {};
  if (filters.page) {
    query.page = filters.page;
  }
  if (filters.pageSize) {
    query.perPage = filters.pageSize;
  }
  if (filters.search) {
    query.search = filters.search;
  }
  if (filters.tags?.length) {
    query.tags = filters.tags;
  }
  if (filters.categoryId) {
    query.categoryId = filters.categoryId;
  }
  if (filters.categorySlug) {
    query.categorySlug = filters.categorySlug;
  }
  if (filters.sort) {
    query.sort = filters.sort;
  }
  if (filters.cursor) {
    query.cursor = filters.cursor;
  }
  if (filters.statuses?.length) {
    query.statuses = filters.statuses;
  }

  return query;
};

const FALLBACK_PAGINATION = {
  page: 1,
  pageSize: 0,
  totalItems: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPreviousPage: false,
};

export const useProducts = (
  filters: ProductListFilters = {},
  options: { enabled?: boolean; authToken?: string; staleTimeMs?: number; gcTimeMs?: number } = {},
) => {
  const serializedFilters = useMemo(() => JSON.stringify(filters ?? {}), [filters]);
  const normalizedFilters = useMemo(
    () => normalizeFilters(JSON.parse(serializedFilters) as ProductListFilters),
    [serializedFilters],
  );

  return useQuery<ProductListResult>({
    queryKey: productKeys.list(normalizedFilters),
    queryFn: async (): Promise<ProductListResult> => {
      const response = await apiClient.get("/catalog/products", {
        query: buildQuery(normalizedFilters),
        dataSchema: productListSchema,
        metaSchema: paginatedMetaSchema,
        authToken: options.authToken,
      });

      const pagination = response.meta?.pagination ?? {
        ...FALLBACK_PAGINATION,
        page: normalizedFilters.page ?? FALLBACK_PAGINATION.page,
        pageSize: normalizedFilters.pageSize ?? FALLBACK_PAGINATION.pageSize,
      };

      return {
        items: response.data,
        pagination,
        cursor: response.meta?.cursor ?? undefined,
      };
    },
    placeholderData: (previousData) => previousData,
    staleTime: options.staleTimeMs,
    gcTime: options.gcTimeMs,
    enabled: options.enabled ?? true,
  });
};
