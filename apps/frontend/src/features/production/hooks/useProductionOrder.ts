"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";

import { productionOrderDetailSchema, type ProductionOrderDetail } from "../types/production.types";
import { productionKeys } from "./production.keys";

export const useProductionOrder = (orderId: string | undefined) => {
  const normalized = orderId?.trim();

  return useQuery<ProductionOrderDetail>({
    queryKey: productionKeys.order(normalized ?? "unknown"),
    enabled: Boolean(normalized),
    queryFn: async () => {
      if (!normalized) {
        throw new Error("Order identifier is required.");
      }

      const response = await apiClient.get(`/admin/production/order/${normalized}`, {
        dataSchema: productionOrderDetailSchema,
        retry: 1,
      });
      return response.data;
    },
    staleTime: 5000,
    gcTime: 60_000,
  });
};
