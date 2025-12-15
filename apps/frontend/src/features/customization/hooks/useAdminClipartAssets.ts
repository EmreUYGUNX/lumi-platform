"use client";

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { apiClient } from "@/lib/api-client";

import {
  clipartAssetSchema,
  clipartPaginationMetaSchema,
  type ClipartAssetView,
  type ClipartPaginationMeta,
} from "../types/clipart.types";
import type { ClipartListQuery } from "./useClipartAssets";
import { clipartKeys } from "./clipart.keys";

export interface AdminClipartListResult {
  items: ClipartAssetView[];
  pagination?: ClipartPaginationMeta["pagination"];
}

export const useAdminClipartAssets = (query: ClipartListQuery) => {
  return useQuery<AdminClipartListResult>({
    queryKey: clipartKeys.adminList(query),
    queryFn: async () => {
      const response = await apiClient.get("/admin/clipart", {
        query: {
          page: query.page,
          perPage: query.perPage,
          category: query.category,
          tag: query.tag,
          tags: query.tags,
          isPaid: query.isPaid,
          sort: query.sort,
          order: query.order,
        },
        dataSchema: z.array(clipartAssetSchema),
        metaSchema: clipartPaginationMetaSchema,
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
