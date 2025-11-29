import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { cuidSchema } from "@lumi/shared/dto";
import { apiClient } from "@/lib/api-client";
import { uiStore } from "@/store";

import type { CartSummaryView } from "../types/cart.types";
import { cartSummaryViewSchema } from "../types/cart.types";
import { cartStore } from "../store/cart.store";
import { cartKeys } from "./cart.keys";

const removeCartItemSchema = z.object({
  itemId: cuidSchema,
});

interface RemoveCartContext {
  previous?: CartSummaryView;
}

export const useRemoveCartItem = () => {
  const queryClient = useQueryClient();

  return useMutation<
    CartSummaryView,
    Error,
    z.infer<typeof removeCartItemSchema>,
    RemoveCartContext
  >({
    mutationKey: cartKeys.items(),
    mutationFn: async (input) => {
      const payload = removeCartItemSchema.parse(input);
      const response = await apiClient.delete(`/cart/items/${payload.itemId}`, {
        dataSchema: cartSummaryViewSchema,
      });
      return response.data;
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: cartKeys.summary() });
      const parsed = removeCartItemSchema.safeParse(input);
      const previous = queryClient.getQueryData<CartSummaryView>(cartKeys.summary());

      if (parsed.success && previous) {
        const optimistic = {
          ...previous,
          cart: {
            ...previous.cart,
            items: previous.cart.items.filter((item) => item.id !== parsed.data.itemId),
          },
        };
        queryClient.setQueryData(cartKeys.summary(), optimistic);
      }

      if (parsed.success) {
        cartStore.getState().removeItem(parsed.data.itemId);
      }

      return { previous };
    },
    onSuccess: (data) => {
      queryClient.setQueryData(cartKeys.summary(), data);
      cartStore.getState().sync(data);
      uiStore.getState().enqueueToast({
        variant: "success",
        title: "Ürün kaldırıldı",
        description: "Ürün sepetten çıkarıldı.",
      });
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(cartKeys.summary(), context.previous);
        cartStore.getState().sync(context.previous);
      }
      uiStore.getState().enqueueToast({
        variant: "error",
        title: "Ürün kaldırılamadı",
        description: error.message ?? "Sepet güncellenemedi.",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: cartKeys.summary() }).catch(() => {});
    },
  });
};
