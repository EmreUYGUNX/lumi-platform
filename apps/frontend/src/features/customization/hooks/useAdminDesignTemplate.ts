"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";

import { designTemplateViewSchema, type DesignTemplateView } from "../types/templates.types";
import { templateKeys } from "./template.keys";

export const useAdminDesignTemplate = (id?: string) => {
  return useQuery<DesignTemplateView>({
    queryKey: id ? templateKeys.adminDetail(id) : templateKeys.adminDetail("missing"),
    queryFn: async () => {
      if (!id) {
        throw new Error("Template id is required.");
      }

      const response = await apiClient.get(`/admin/templates/${id}`, {
        dataSchema: designTemplateViewSchema,
        retry: 1,
      });

      return response.data;
    },
    enabled: Boolean(id),
    staleTime: 10_000,
    gcTime: 120_000,
  });
};
