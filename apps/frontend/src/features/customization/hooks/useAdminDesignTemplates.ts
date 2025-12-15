"use client";

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { apiClient } from "@/lib/api-client";

import {
  designTemplateSummarySchema,
  templatePaginationMetaSchema,
  type DesignTemplateSummaryView,
  type TemplatePaginationMeta,
} from "../types/templates.types";
import type { DesignTemplateListQuery } from "./useDesignTemplates";
import { templateKeys } from "./template.keys";

export interface AdminDesignTemplateListResult {
  items: DesignTemplateSummaryView[];
  pagination?: TemplatePaginationMeta["pagination"];
}

export const useAdminDesignTemplates = (query: DesignTemplateListQuery) => {
  return useQuery<AdminDesignTemplateListResult>({
    queryKey: templateKeys.adminList(query),
    queryFn: async () => {
      const response = await apiClient.get("/admin/templates", {
        query: {
          page: query.page,
          perPage: query.perPage,
          category: query.category,
          tag: query.tag,
          tags: query.tags,
          isPaid: query.isPaid,
          featured: query.featured,
          published: query.published,
          sort: query.sort,
          order: query.order,
        },
        dataSchema: z.array(designTemplateSummarySchema),
        metaSchema: templatePaginationMetaSchema,
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
