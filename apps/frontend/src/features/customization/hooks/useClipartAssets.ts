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
import { clipartKeys } from "./clipart.keys";

export interface ClipartListQuery {
  page?: number;
  perPage?: number;
  category?: string;
  tag?: string;
  tags?: string[];
  isPaid?: boolean;
  sort?: "popularity" | "newest";
  order?: "asc" | "desc";
}

export interface ClipartListResult {
  items: ClipartAssetView[];
  pagination?: ClipartPaginationMeta["pagination"];
}

export const useClipartAssets = (query: ClipartListQuery) => {
  return useQuery<ClipartListResult>({
    queryKey: clipartKeys.list(query),
    queryFn: async () => {
      const response = await apiClient.get("/clipart", {
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
    staleTime: 60_000,
    gcTime: 120_000,
  });
};
