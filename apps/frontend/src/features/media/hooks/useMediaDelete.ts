import type { InfiniteData } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { deleteMediaRequest } from "../api/media.api";
import type { ListMediaResponse } from "../api/media.api";
import { mediaKeys } from "./media.keys";

interface MediaDeleteVariables {
  id: string;
}

export const useMediaDelete = ({ authToken }: { authToken?: string } = {}) => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, MediaDeleteVariables, { previous?: [unknown, unknown][] }>({
    mutationFn: (variables) => deleteMediaRequest({ id: variables.id }, authToken),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: mediaKeys.all });
      const previous = queryClient.getQueriesData({ queryKey: [mediaKeys.all[0], "list"] });

      previous.forEach(([key, data]) => {
        const infinite = data as InfiniteData<ListMediaResponse> | undefined;
        if (!infinite) {
          return;
        }

        const nextPages = infinite.pages.map((page) => ({
          ...page,
          items: page.items.filter((asset) => asset.id !== variables.id),
          meta: page.meta,
        }));

        queryClient.setQueryData(key, {
          ...infinite,
          pages: nextPages,
        });
      });

      return { previous };
    },
    onError: (_error, _variables, context) => {
      context?.previous?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: mediaKeys.all });
    },
  });
};
