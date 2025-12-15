"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { uiStore } from "@/store";

import {
  productionGenerateResultSchema,
  type ProductionGenerateResult,
} from "../types/production.types";
import { productionKeys } from "./production.keys";

export const useGenerateProduction = () => {
  const queryClient = useQueryClient();

  return useMutation<ProductionGenerateResult, Error, { orderItemId: string; force?: boolean }>({
    mutationKey: productionKeys.generate(),
    mutationFn: async (payload) => {
      const response = await apiClient.post("/admin/production/generate", {
        body: {
          orderItemId: payload.orderItemId,
          force: payload.force,
        },
        dataSchema: productionGenerateResultSchema,
      });

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productionKeys.all() }).catch(() => {});
      uiStore.getState().enqueueToast({
        variant: "success",
        title: "Production file generated",
        description: "Production output is ready for download.",
      });
    },
    onError: (error) => {
      uiStore.getState().enqueueToast({
        variant: "error",
        title: "Production generation failed",
        description: error.message || "Unable to generate production file.",
      });
    },
  });
};
