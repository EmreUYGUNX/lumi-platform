"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { uiStore } from "@/store";

import {
  productionDownloadResultSchema,
  type ProductionDownloadResult,
} from "../types/production.types";
import { productionKeys } from "./production.keys";

export const useProductionDownloadUrl = () => {
  const queryClient = useQueryClient();

  return useMutation<ProductionDownloadResult, Error, string>({
    mutationKey: productionKeys.download(),
    mutationFn: async (customizationId) => {
      const response = await apiClient.get(`/admin/production/download/${customizationId}`, {
        dataSchema: productionDownloadResultSchema,
      });

      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: productionKeys.all() }).catch(() => {});
      uiStore.getState().enqueueToast({
        variant: "success",
        title: "Download ready",
        description: "Production file download started.",
      });

      if (typeof window !== "undefined") {
        window.open(data.downloadUrl, "_blank", "noopener,noreferrer");
      }
    },
    onError: (error) => {
      uiStore.getState().enqueueToast({
        variant: "error",
        title: "Download failed",
        description: error.message || "Unable to generate a download link.",
      });
    },
  });
};
