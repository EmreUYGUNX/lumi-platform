"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";

import { clipartAssetSchema, type ClipartAssetView } from "../types/clipart.types";
import { clipartKeys } from "./clipart.keys";

export const useClipartAsset = (id?: string) => {
  return useQuery<ClipartAssetView>({
    queryKey: id ? clipartKeys.detail(id) : clipartKeys.detail("missing"),
    queryFn: async () => {
      if (!id) {
        throw new Error("Clipart id is required.");
      }

      const response = await apiClient.get(`/clipart/${id}`, {
        dataSchema: clipartAssetSchema,
        retry: 1,
      });

      return response.data;
    },
    enabled: Boolean(id),
    staleTime: 60_000,
    gcTime: 120_000,
  });
};
