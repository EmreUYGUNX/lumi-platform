"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { sessionStore } from "@/store/session";

import type { Wishlist } from "../types/wishlist.types";
import { wishlistSchema } from "../types/wishlist.types";
import { wishlistKeys } from "./wishlist.keys";

interface UseWishlistOptions {
  enabled?: boolean;
  authToken?: string;
}

export const useWishlist = (options: UseWishlistOptions = {}) => {
  const isAuthenticated = sessionStore((state) => state.isAuthenticated);
  const hasToken = sessionStore((state) => Boolean(state.accessToken));
  const enabled =
    Boolean(options.enabled ?? true) && Boolean(isAuthenticated || hasToken || options.authToken);

  return useQuery<Wishlist>({
    queryKey: wishlistKeys.list(),
    queryFn: async () => {
      const response = await apiClient.get("/wishlist", {
        dataSchema: wishlistSchema,
        authToken: options.authToken,
        retry: 1,
      });
      return response.data;
    },
    enabled,
    staleTime: 45_000,
    placeholderData: (previousData) => previousData,
  });
};
