"use client";

import { useQuery } from "@tanstack/react-query";

import { productSummarySchema } from "@lumi/shared/dto";
import { ApiClientError, apiClient } from "@/lib/api-client";

import type { ProductSummary } from "../types/product.types";
import { productKeys } from "./product.keys";

interface UseAdminProductByIdOptions {
  enabled?: boolean;
  staleTimeMs?: number;
  gcTimeMs?: number;
}

export const useAdminProductById = (
  productId: string | undefined,
  options: UseAdminProductByIdOptions = {},
) => {
  const normalized = productId?.trim();

  return useQuery<ProductSummary | undefined>({
    queryKey: productKeys.adminDetail(normalized ?? "unknown"),
    enabled: Boolean(normalized) && (options.enabled ?? true),
    queryFn: async () => {
      let product: ProductSummary | undefined;
      if (!normalized) {
        return product;
      }

      try {
        const response = await apiClient.get(`/admin/products/${normalized}`, {
          dataSchema: productSummarySchema,
          retry: 1,
        });
        product = response.data;
      } catch (error) {
        if (error instanceof ApiClientError && error.status === 404) {
          return product;
        }
        throw error;
      }

      return product;
    },
    staleTime: options.staleTimeMs ?? 60_000,
    gcTime: options.gcTimeMs ?? 120_000,
  });
};
