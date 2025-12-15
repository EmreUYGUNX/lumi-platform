import type { ClipartListQuery } from "./useClipartAssets";

export const clipartKeys = {
  all: () => ["clipart"] as const,
  list: (query: ClipartListQuery) => [...clipartKeys.all(), "list", JSON.stringify(query)] as const,
  detail: (id: string) => [...clipartKeys.all(), "detail", id] as const,
  adminList: (query: ClipartListQuery) =>
    [...clipartKeys.all(), "admin-list", JSON.stringify(query)] as const,
  adminDetail: (id: string) => [...clipartKeys.all(), "admin-detail", id] as const,
};
