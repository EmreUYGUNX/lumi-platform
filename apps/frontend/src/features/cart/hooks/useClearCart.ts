import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { uiStore } from "@/store";

import type { CartSummaryView } from "../types/cart.types";
import { cartSummaryViewSchema } from "../types/cart.types";
import { cartStore } from "../store/cart.store";
import { cartKeys } from "./cart.keys";

interface ClearCartContext {
  previous?: CartSummaryView;
}

export const useClearCart = () => {
  const queryClient = useQueryClient();

  return useMutation<CartSummaryView, Error, void, ClearCartContext>({
    mutationKey: cartKeys.clear(),
    mutationFn: async () => {
      const response = await apiClient.delete("/cart", {
        dataSchema: cartSummaryViewSchema,
      });
      return response.data;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: cartKeys.summary() });
      const previous = queryClient.getQueryData<CartSummaryView>(cartKeys.summary());
      cartStore.getState().clear();

      if (previous) {
        const optimistic = {
          ...previous,
          cart: {
            ...previous.cart,
            items: [],
          },
        };
        queryClient.setQueryData(cartKeys.summary(), optimistic);
      }

      return { previous };
    },
    onSuccess: (data) => {
      queryClient.setQueryData(cartKeys.summary(), data);
      cartStore.getState().sync(data);
      uiStore.getState().enqueueToast({
        variant: "success",
        title: "Sepet temizlendi",
        description: "Sepetteki tüm ürünler kaldırıldı.",
      });
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(cartKeys.summary(), context.previous);
        cartStore.getState().sync(context.previous);
      }
      uiStore.getState().enqueueToast({
        variant: "error",
        title: "Sepet temizlenemedi",
        description: error.message ?? "Lütfen tekrar deneyin.",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: cartKeys.summary() }).catch(() => {});
    },
  });
};
