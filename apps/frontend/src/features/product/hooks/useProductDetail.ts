import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { productKeys } from "@/features/products/hooks/product.keys";

import type { ProductDetail } from "../types/product-detail.types";
import { productDetailSchema } from "../types/product-detail.types";

interface UseProductDetailOptions {
  enabled?: boolean;
  authToken?: string;
  staleTimeMs?: number;
  gcTimeMs?: number;
  initialData?: ProductDetail;
}

export const useProductDetail = (
  slug: string | undefined,
  options: UseProductDetailOptions = {},
) => {
  const normalizedSlug = slug?.trim();

  return useQuery<ProductDetail>({
    queryKey: productKeys.detail(normalizedSlug ?? "unknown"),
    queryFn: async () => {
      const response = await apiClient.get(
        `/catalog/products/${encodeURIComponent(normalizedSlug!)}`,
        {
          dataSchema: productDetailSchema,
          authToken: options.authToken,
        },
      );

      const { reviews } = response.data;

      return {
        ...response.data,
        reviews: {
          ...reviews,
          averageRating: Number.isFinite(reviews.averageRating) ? reviews.averageRating : 0,
          ratingBreakdown: reviews.ratingBreakdown,
        },
      };
    },
    enabled: Boolean(normalizedSlug) && (options.enabled ?? true),
    staleTime: options.staleTimeMs ?? 300_000,
    gcTime: options.gcTimeMs ?? 600_000,
    initialData: options.initialData,
  });
};
