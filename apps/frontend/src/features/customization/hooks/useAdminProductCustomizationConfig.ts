"use client";

import { useQuery } from "@tanstack/react-query";

import { ApiClientError, apiClient } from "@/lib/api-client";

import type { ProductCustomizationConfig } from "../types/product-customization.types";
import { productCustomizationConfigSchema } from "../types/product-customization.types";
import { customizationKeys } from "./customization.keys";

interface UseAdminProductCustomizationConfigOptions {
  enabled?: boolean;
  staleTimeMs?: number;
  gcTimeMs?: number;
}

export const useAdminProductCustomizationConfig = (
  productId: string | undefined,
  options: UseAdminProductCustomizationConfigOptions = {},
) => {
  const normalized = productId?.trim();

  return useQuery<ProductCustomizationConfig | undefined>({
    queryKey: customizationKeys.adminConfig(normalized ?? "unknown"),
    enabled: Boolean(normalized) && (options.enabled ?? true),
    queryFn: async () => {
      let config: ProductCustomizationConfig | undefined;
      if (!normalized) {
        return config;
      }

      try {
        const response = await apiClient.get(`/admin/products/${normalized}/customization`, {
          dataSchema: productCustomizationConfigSchema,
          retry: 1,
        });
        config = response.data;
      } catch (error) {
        if (error instanceof ApiClientError && error.status === 404) {
          return config;
        }
        throw error;
      }

      return config;
    },
    staleTime: options.staleTimeMs ?? 120_000,
    gcTime: options.gcTimeMs ?? 600_000,
  });
};
