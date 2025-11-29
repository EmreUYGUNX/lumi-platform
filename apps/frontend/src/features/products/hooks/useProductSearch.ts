import { useMemo } from "react";

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { productSummarySchema } from "@lumi/shared/dto";
import { apiClient } from "@/lib/api-client";

import type { ProductListResult } from "../types/product.types";
import { buildProductQuery, normalizeProductFilters, paginatedMetaSchema } from "./product-query";
import { productKeys } from "./product.keys";

const productListSchema = z.array(productSummarySchema);
const MIN_SEARCH_LENGTH = 2;
const SUGGESTION_LIMIT = 6;

export const useProductSearch = (rawTerm: string, enabled = true) => {
  const normalizedTerm = useMemo(() => rawTerm.trim(), [rawTerm]);

  return useQuery<ProductListResult>({
    queryKey: productKeys.search(normalizedTerm),
    enabled: enabled && normalizedTerm.length >= MIN_SEARCH_LENGTH,
    staleTime: 30_000,
    gcTime: 60_000,
    queryFn: async () => {
      const response = await apiClient.get("/catalog/products", {
        query: buildProductQuery(
          normalizeProductFilters({
            search: normalizedTerm,
            page: 1,
            pageSize: SUGGESTION_LIMIT,
            sort: "relevance",
          }),
        ),
        dataSchema: productListSchema,
        metaSchema: paginatedMetaSchema,
      });

      return {
        items: response.data,
        pagination: response.meta?.pagination ?? {
          page: 1,
          pageSize: SUGGESTION_LIMIT,
          totalItems: response.data.length,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
        cursor: response.meta?.cursor,
      };
    },
  });
};
