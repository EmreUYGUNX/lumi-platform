"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { uiStore } from "@/store";
import { sessionStore } from "@/store/session";

import type { RemoveFromWishlistInput, Wishlist } from "../types/wishlist.types";
import { removeFromWishlistInputSchema, wishlistSchema } from "../types/wishlist.types";
import { wishlistKeys } from "./wishlist.keys";

interface RemoveFromWishlistContext {
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

const isAuthenticated = (): boolean => {
  const state = sessionStore.getState();
  return Boolean(state.isAuthenticated || state.accessToken);
};

export const useRemoveFromWishlist = () => {
  const queryClient = useQueryClient();

  return useMutation<Wishlist, Error, RemoveFromWishlistInput, RemoveFromWishlistContext>({
    mutationKey: wishlistKeys.removeItem(),
    mutationFn: async (input) => {
      if (!isAuthenticated()) {
        throw new Error(AUTH_REQUIRED_ERROR);
      }

      const payload = removeFromWishlistInputSchema.parse(input);
      const response = await apiClient.delete(`/wishlist/items/${payload.itemId}`, {
        dataSchema: wishlistSchema,
      });
      emitWishlistEvent("wishlist.removed", { itemId: payload.itemId });
      return response.data;
    },
    onMutate: async (variables) => {
      if (!isAuthenticated()) {
        uiStore.getState().enqueueToast({
          variant: "warning",
          title: "Giriş gerekli",
          description: "Favori listenizden kaldırmak için lütfen giriş yapın.",
        });
        throw new Error(AUTH_REQUIRED_ERROR);
      }

      await queryClient.cancelQueries({ queryKey: wishlistKeys.list() });
      const previous = queryClient.getQueryData<Wishlist>(wishlistKeys.list());

      if (previous) {
        queryClient.setQueryData(wishlistKeys.list(), {
          ...previous,
          items: previous.items.filter((item) => item.id !== variables.itemId),
          updatedAt: new Date().toISOString(),
        });
      }

      return { previous };
    },
    onSuccess: (data) => {
      queryClient.setQueryData(wishlistKeys.list(), data);
      uiStore.getState().enqueueToast({
        variant: "success",
        title: "Favoriler güncellendi",
        description: "Ürün listeden kaldırıldı.",
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
        title: "Kaldırılamadı",
        description: error.message || "Favori listeniz güncellenemedi.",
      });
      emitWishlistEvent("wishlist.remove_failed", {
        reason: error.message ?? "unknown",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: wishlistKeys.list() }).catch(() => {});
    },
  });
};
