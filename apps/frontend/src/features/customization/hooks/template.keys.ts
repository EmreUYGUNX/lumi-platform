import type { DesignTemplateListQuery } from "./useDesignTemplates";

export const templateKeys = {
  all: () => ["templates"] as const,
  list: (query: DesignTemplateListQuery) =>
    [...templateKeys.all(), "list", JSON.stringify(query)] as const,
  detail: (id: string) => [...templateKeys.all(), "detail", id] as const,
  adminList: (query: DesignTemplateListQuery) =>
    [...templateKeys.all(), "admin-list", JSON.stringify(query)] as const,
  adminDetail: (id: string) => [...templateKeys.all(), "admin-detail", id] as const,
};
