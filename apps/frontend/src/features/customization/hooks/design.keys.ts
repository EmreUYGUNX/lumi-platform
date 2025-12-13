import type { DesignListQuery } from "../types/design.types";

export const designKeys = {
  all: ["designs"] as const,
  lists: () => [...designKeys.all, "list"] as const,
  list: (query: DesignListQuery) => [...designKeys.lists(), query] as const,
  uploads: () => [...designKeys.all, "upload"] as const,
};
