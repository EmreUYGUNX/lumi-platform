import { useMemo } from "react";

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { apiClient } from "@/lib/api-client";
import { sessionStore } from "@/store/session";

import { designKeys } from "./design.keys";
import type { CustomerDesignView, DesignListMeta, DesignListQuery } from "../types/design.types";
import { customerDesignViewSchema, designListMetaSchema } from "../types/design.types";

const designsArraySchema = z.array(customerDesignViewSchema);

export const useUserDesigns = (query: DesignListQuery = {}) => {
  const isAuthenticated = sessionStore((state) => state.isAuthenticated);
  const accessToken = sessionStore((state) => state.accessToken);

  const apiQuery = useMemo(
    () => ({
      page: query.page,
      perPage: query.perPage,
      tag: query.tag,
      tags: query.tags,
      sort: query.sort,
      order: query.order,
    }),
    [query.order, query.page, query.perPage, query.sort, query.tag, query.tags],
  );

  return useQuery<{ data: CustomerDesignView[]; meta?: DesignListMeta }>({
    queryKey: designKeys.list(query),
    queryFn: async () => {
      const response = await apiClient.get("/designs", {
        query: apiQuery,
        dataSchema: designsArraySchema,
        metaSchema: designListMetaSchema,
      });

      return { data: response.data, meta: response.meta };
    },
    enabled: Boolean(isAuthenticated || accessToken),
    staleTime: 15_000,
    gcTime: 90_000,
  });
};
