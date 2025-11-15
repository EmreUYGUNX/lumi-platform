import { useInfiniteQuery } from "@tanstack/react-query";

import { listMediaRequest } from "../api/media.api";
import type { MediaListFilters } from "../types/media.types";
import { mediaKeys } from "./media.keys";

const PAGE_SIZE = 24;

const pickListRequest = (filters: MediaListFilters, page: number) => ({
  page,
  perPage: PAGE_SIZE,
  folder: filters.folder,
  resourceType: filters.resourceType,
  search: filters.search,
  includeDeleted: filters.includeDeleted,
  tags: filters.tags,
});

export const useMediaList = (filters: MediaListFilters, options: { authToken?: string } = {}) =>
  useInfiniteQuery({
    queryKey: mediaKeys.list(filters),
    queryFn: ({ pageParam = 1 }) =>
      listMediaRequest(pickListRequest(filters, pageParam), options.authToken),
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasNextPage ? lastPage.meta.page + 1 : undefined,
    initialPageParam: 1,
  });
