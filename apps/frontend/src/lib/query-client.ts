/* istanbul ignore file */
import {
  MutationCache,
  QueryCache,
  QueryClient,
  defaultShouldDehydrateQuery,
  isServer,
} from "@tanstack/react-query";

import { uiStore } from "@/store";

const DEFAULT_STALE_TIME = 60 * 1000;
const MAX_RETRY_DELAY = 30_000;

const backoffDelay = (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, MAX_RETRY_DELAY);

const rootErrorHandler = (error: unknown) => {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "Unexpected error";

  if (process.env.NODE_ENV !== "production") {
    console.error("[QueryClient] request failed", error);
  }

  if (isServer) {
    return;
  }

  uiStore.getState().enqueueToast({
    title: "Bağlantı hatası",
    description: typeof message === "string" ? message : "İstek tamamlanamadı.",
    variant: "error",
  });
};

export const createQueryClient = () =>
  new QueryClient({
    queryCache: new QueryCache({
      onError: rootErrorHandler,
    }),
    mutationCache: new MutationCache({
      onError: rootErrorHandler,
    }),
    defaultOptions: {
      queries: {
        staleTime: DEFAULT_STALE_TIME,
        retry: (failureCount, error) => {
          if (failureCount >= 3) {
            return false;
          }
          if (error instanceof TypeError && error.message === "Failed to fetch") {
            return true;
          }
          return failureCount < 3;
        },
        retryDelay: backoffDelay,
        refetchOnWindowFocus: false,
        throwOnError: false,
      },
      mutations: {
        retry: 2,
        retryDelay: backoffDelay,
        throwOnError: false,
      },
      dehydrate: {
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === "pending",
      },
    },
  });
