"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { ProductSummary } from "@/features/products/types/product.types";
import { apiClient } from "@/lib/api-client";
import { uiStore } from "@/store";
import { sessionStore } from "@/store/session";

import type { AddToWishlistInput, Wishlist, WishlistItem } from "../types/wishlist.types";
import { addToWishlistInputSchema, wishlistSchema } from "../types/wishlist.types";
import { wishlistKeys } from "./wishlist.keys";

interface AddToWishlistVariables extends AddToWishlistInput {
  product?: ProductSummary;
}

interface AddToWishlistContext {
  previous?: Wishlist;
}

const AUTH_REQUIRED_ERROR = "AUTH_REQUIRED";

const emitWishlistEvent = (event: string, payload?: Record<string, unknown>) => {
  if (typeof window === "undefined") return;

  try {
    const { posthog } = window as {
      posthog?: { capture?: (e: string, p?: Record<string, unknown>) => void };
    };
    posthog?.capture?.(event, payload);

    const { amplitude } = window as {
      amplitude?: {
        getInstance?: () => { logEvent?: (e: string, p?: Record<string, unknown>) => void };
      };
    };
    amplitude?.getInstance?.()?.logEvent?.(event, payload);

    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console -- surfaced only during development for diagnostics
      console.info(`[wishlist] ${event}`, payload);
    }
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console -- surfaced only during development for diagnostics
      console.warn("[wishlist] analytics emit failed", error);
    }
  }
};

const createOptimisticItem = (product: ProductSummary): WishlistItem => ({
  id: product.id,
  productId: product.id,
  product,
  addedAt: new Date().toISOString(),
});

const isAuthenticated = (): boolean => {
  const state = sessionStore.getState();
  return Boolean(state.isAuthenticated || state.accessToken);
};

export const useAddToWishlist = () => {
  const queryClient = useQueryClient();

  return useMutation<Wishlist, Error, AddToWishlistVariables, AddToWishlistContext>({
    mutationKey: wishlistKeys.addItem(),
    mutationFn: async (input) => {
      if (!isAuthenticated()) {
        throw new Error(AUTH_REQUIRED_ERROR);
      }

      const payload = addToWishlistInputSchema.parse({ productId: input.productId });
      const response = await apiClient.post("/wishlist/items", {
        body: payload,
        dataSchema: wishlistSchema,
      });

      emitWishlistEvent("wishlist.added", { productId: payload.productId });
      return response.data;
    },
    onMutate: async (variables) => {
      if (!isAuthenticated()) {
        uiStore.getState().enqueueToast({
          variant: "warning",
          title: "Giriş gerekli",
          description: "Favorilere eklemek için lütfen giriş yapın.",
        });
        throw new Error(AUTH_REQUIRED_ERROR);
      }

      await queryClient.cancelQueries({ queryKey: wishlistKeys.list() });
      const previous = queryClient.getQueryData<Wishlist>(wishlistKeys.list());
      const userId = sessionStore.getState().user?.id ?? "wishlist-guest";
      const baseWishlist: Wishlist = previous ?? {
        id: `wishlist_${userId}`,
        userId,
        items: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (variables.product) {
        const optimisticItem = createOptimisticItem(variables.product);
        const deduped = baseWishlist.items.some((item) => item.productId === variables.productId)
          ? baseWishlist.items
          : [optimisticItem, ...baseWishlist.items];

        queryClient.setQueryData(wishlistKeys.list(), {
          ...baseWishlist,
          items: deduped,
          updatedAt: new Date().toISOString(),
        });
      } else if (!previous) {
        queryClient.setQueryData(wishlistKeys.list(), baseWishlist);
      }

      return { previous };
    },
    onSuccess: (data) => {
      queryClient.setQueryData(wishlistKeys.list(), data);
      uiStore.getState().enqueueToast({
        variant: "success",
        title: "Favorilere eklendi",
        description: "Ürün favori listenize eklendi.",
      });
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(wishlistKeys.list(), context.previous);
      }

      if (error.message === AUTH_REQUIRED_ERROR) {
        return;
      }

      uiStore.getState().enqueueToast({
        variant: "error",
        title: "Favorilere eklenemedi",
        description: error.message || "Favorilere ekleme sırasında bir sorun oluştu.",
      });
      emitWishlistEvent("wishlist.add_failed", {
        reason: error.message ?? "unknown",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: wishlistKeys.list() }).catch(() => {});
    },
  });
};
