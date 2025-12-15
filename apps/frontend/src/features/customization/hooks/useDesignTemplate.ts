"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";

import { designTemplateViewSchema, type DesignTemplateView } from "../types/templates.types";
import { templateKeys } from "./template.keys";

export const useDesignTemplate = (id?: string) => {
  return useQuery<DesignTemplateView>({
    queryKey: id ? templateKeys.detail(id) : templateKeys.detail("missing"),
    queryFn: async () => {
      if (!id) {
        throw new Error("Template id is required.");
      }

      const response = await apiClient.get(`/templates/${id}`, {
        dataSchema: designTemplateViewSchema,
        retry: 1,
      });

      return response.data;
    },
    enabled: Boolean(id),
    staleTime: 30_000,
    gcTime: 120_000,
  });
};
