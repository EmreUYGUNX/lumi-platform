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
import { templateKeys } from "./template.keys";

export interface DesignTemplateListQuery {
  page?: number;
  perPage?: number;
  category?: string;
  tag?: string;
  tags?: string[];
  isPaid?: boolean;
  featured?: boolean;
  published?: boolean;
  sort?: "popularity" | "newest";
  order?: "asc" | "desc";
}

export interface DesignTemplateListResult {
  items: DesignTemplateSummaryView[];
  pagination?: TemplatePaginationMeta["pagination"];
}

export const useDesignTemplates = (query: DesignTemplateListQuery) => {
  return useQuery<DesignTemplateListResult>({
    queryKey: templateKeys.list(query),
    queryFn: async () => {
      const response = await apiClient.get("/templates", {
        query: {
          page: query.page,
          perPage: query.perPage,
          category: query.category,
          tag: query.tag,
          tags: query.tags,
          isPaid: query.isPaid,
          featured: query.featured,
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
    staleTime: 30_000,
    gcTime: 120_000,
  });
};
