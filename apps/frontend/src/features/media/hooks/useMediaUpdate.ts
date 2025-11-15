import type { InfiniteData } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateMediaRequest } from "../api/media.api";
import type { ListMediaResponse } from "../api/media.api";
import type { MediaAsset, MediaUpdatePayload } from "../types/media.types";
import { mediaKeys } from "./media.keys";

export const useMediaUpdate = ({ authToken }: { authToken?: string } = {}) => {
  const queryClient = useQueryClient();

  return useMutation<MediaAsset, Error, MediaUpdatePayload>({
    mutationFn: (payload) => updateMediaRequest(payload, authToken),
    onSuccess: (asset) => {
      const queries = queryClient.getQueriesData({ queryKey: [mediaKeys.all[0], "list"] });
      queries.forEach(([key, data]) => {
        const infinite = data as InfiniteData<ListMediaResponse> | undefined;
        if (!infinite) {
          return;
        }

        const pages = infinite.pages.map((page) => ({
          ...page,
          items: page.items.map((existing) => (existing.id === asset.id ? asset : existing)),
        }));

        queryClient.setQueryData(key, { ...infinite, pages });
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: mediaKeys.all });
    },
  });
};
