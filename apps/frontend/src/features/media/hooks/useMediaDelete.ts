import type { InfiniteData } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { deleteMediaRequest } from "../api/media.api";
import type { ListMediaResponse } from "../api/media.api";
import { mediaKeys } from "./media.keys";

interface MediaDeleteVariables {
  id: string;
}

type MediaListInfiniteData = InfiniteData<ListMediaResponse>;
type PreviousQueries = [readonly unknown[], MediaListInfiniteData | undefined][];

export const useMediaDelete = ({ authToken }: { authToken?: string } = {}) => {
  const queryClient = useQueryClient();

  return useMutation<
    void,
    Error,
    MediaDeleteVariables,
    {
      previous?: PreviousQueries;
    }
  >({
    mutationFn: (variables) => deleteMediaRequest({ id: variables.id }, authToken),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: mediaKeys.all });
      const previous = queryClient.getQueriesData<MediaListInfiniteData>({
        queryKey: ["media", "list"],
      });

      previous.forEach(([key, data]) => {
        if (!data) {
          return;
        }

        const nextPages = data.pages.map((page) => ({
          ...page,
          items: page.items.filter((asset) => asset.id !== variables.id),
        }));

        queryClient.setQueryData(key, {
          ...data,
          pages: nextPages,
        });
      });

      return { previous };
    },
    onError: (_error, _variables, context) => {
      context?.previous?.forEach(([key, data]) => {
        if (data) {
          queryClient.setQueryData(key, data);
        }
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: mediaKeys.all });
    },
  });
};
