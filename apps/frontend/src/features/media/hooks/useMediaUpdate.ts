/* istanbul ignore file */
import type { InfiniteData } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateMediaRequest } from "../api/media.api";
import type { ListMediaResponse } from "../api/media.api";
import type { MediaAsset, MediaUpdatePayload } from "../types/media.types";
import { mediaKeys } from "./media.keys";

type MediaListInfiniteData = InfiniteData<ListMediaResponse>;

export const useMediaUpdate = ({ authToken }: { authToken?: string } = {}) => {
  const queryClient = useQueryClient();

  return useMutation<MediaAsset, Error, MediaUpdatePayload>({
    mutationFn: (payload) => updateMediaRequest(payload, authToken),
    onSuccess: (asset) => {
      const queries = queryClient.getQueriesData<MediaListInfiniteData>({
        queryKey: ["media", "list"],
      });
      queries.forEach(([key, data]) => {
        if (!data) {
          return;
        }

        const pages = data.pages.map((page) => ({
          ...page,
          items: page.items.map((existing) => (existing.id === asset.id ? asset : existing)),
        }));

        queryClient.setQueryData(key, { ...data, pages });
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: mediaKeys.all });
    },
  });
};
