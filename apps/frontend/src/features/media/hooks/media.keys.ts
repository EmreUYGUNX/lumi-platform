import type { MediaListFilters } from "../types/media.types";

export const mediaKeys = {
  all: ["media"] as const,
  list: (filters: MediaListFilters) => ["media", "list", filters] as const,
  detail: (id: string) => ["media", "detail", id] as const,
  upload: () => ["media", "upload"] as const,
};
