"use client";

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { apiClient } from "@/lib/api-client";

import {
  productionOrderListItemSchema,
  productionPaginatedMetaSchema,
  type ProductionOrderListItem,
  type ProductionOrderStatus,
  type ProductionPaginationMeta,
} from "../types/production.types";
import { productionKeys } from "./production.keys";

export interface ProductionOrdersQuery {
  page: number;
  pageSize: number;
  status?: ProductionOrderStatus;
  from?: string;
  to?: string;
  search?: string;
}

export interface ProductionOrdersResult {
  items: ProductionOrderListItem[];
  pagination?: ProductionPaginationMeta;
}

export const useProductionOrders = (query: ProductionOrdersQuery) => {
  return useQuery<ProductionOrdersResult>({
    queryKey: productionKeys.orders(query),
    queryFn: async () => {
      const response = await apiClient.get("/admin/production/orders", {
        query: {
          page: query.page,
          pageSize: query.pageSize,
          status: query.status,
          from: query.from,
          to: query.to,
          search: query.search,
        },
        dataSchema: z.array(productionOrderListItemSchema),
        metaSchema: productionPaginatedMetaSchema,
        retry: 1,
      });

      return {
        items: response.data,
        pagination: response.meta?.pagination,
      };
    },
    staleTime: 10_000,
    gcTime: 120_000,
  });
};
