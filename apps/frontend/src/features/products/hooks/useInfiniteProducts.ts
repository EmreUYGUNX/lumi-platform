import { useMemo } from "react";

import { useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";

import { productSummarySchema } from "@lumi/shared/dto";
import { apiClient } from "@/lib/api-client";

import type { ProductListFilters, ProductListResult } from "../types/product.types";
import {
  buildProductQuery,
  FALLBACK_PAGINATION,
  normalizeProductFilters,
  paginatedMetaSchema,
} from "./product-query";
import { productKeys } from "./product.keys";

const productListSchema = z.array(productSummarySchema);

export const useInfiniteProducts = (
  filters: ProductListFilters = {},
  options: { enabled?: boolean; authToken?: string; staleTimeMs?: number; gcTimeMs?: number } = {},
) => {
  const normalizedFilters = useMemo(() => normalizeProductFilters(filters ?? {}), [filters]);

  return useInfiniteQuery<ProductListResult>({
    queryKey: [...productKeys.list(normalizedFilters), "infinite"],
    initialPageParam: normalizedFilters.page ?? 1,
    queryFn: async ({ pageParam }): Promise<ProductListResult> => {
      const pageValue = typeof pageParam === "number" ? pageParam : (normalizedFilters.page ?? 1);
      const response = await apiClient.get("/catalog/products", {
        query: buildProductQuery({
          ...normalizedFilters,
          page: pageValue,
        }),
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
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasNextPage ? lastPage.pagination.page + 1 : undefined,
    staleTime: options.staleTimeMs ?? 60_000,
    gcTime: options.gcTimeMs ?? 120_000,
    enabled: options.enabled ?? true,
  });
};
