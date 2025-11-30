import { useMemo } from "react";

import { useQuery } from "@tanstack/react-query";
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

export const useProducts = (
  filters: ProductListFilters = {},
  options: { enabled?: boolean; authToken?: string; staleTimeMs?: number; gcTimeMs?: number } = {},
) => {
  const serializedFilters = useMemo(() => JSON.stringify(filters ?? {}), [filters]);
  const normalizedFilters = useMemo(
    () => normalizeProductFilters(JSON.parse(serializedFilters) as ProductListFilters),
    [serializedFilters],
  );

  return useQuery<ProductListResult>({
    queryKey: productKeys.list(normalizedFilters),
    queryFn: async (): Promise<ProductListResult> => {
      const response = await apiClient.get("/catalog/products", {
        query: buildProductQuery(normalizedFilters),
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
    staleTime: options.staleTimeMs ?? 60_000,
    gcTime: options.gcTimeMs ?? 120_000,
    enabled: options.enabled ?? true,
  });
};
