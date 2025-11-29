import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { uiStore } from "@/store";

import type { AddCartItemInput, CartSummaryView } from "../types/cart.types";
import { addCartItemInputSchema, cartSummaryViewSchema } from "../types/cart.types";
import { cartStore } from "../store/cart.store";
import { cartKeys } from "./cart.keys";

interface AddToCartContext {
  previous?: CartSummaryView;
}

export const useAddToCart = () => {
  const queryClient = useQueryClient();

  return useMutation<CartSummaryView, Error, AddCartItemInput, AddToCartContext>({
    mutationKey: cartKeys.addItem(),
    mutationFn: async (input) => {
      const payload = addCartItemInputSchema.parse(input);
      const response = await apiClient.post("/cart/items", {
        dataSchema: cartSummaryViewSchema,
        body: payload,
      });
      return response.data;
    },
    onMutate: async (input): Promise<AddToCartContext> => {
      await queryClient.cancelQueries({ queryKey: cartKeys.summary() });
      const previous = queryClient.getQueryData<CartSummaryView>(cartKeys.summary());

      if (previous) {
        const existing = previous.cart.items.find(
          (item) => item.productVariantId === input.productVariantId,
        );

        if (existing) {
          const optimistic = {
            ...previous,
            cart: {
              ...previous.cart,
              items: previous.cart.items.map((item) =>
                item.productVariantId === input.productVariantId
                  ? { ...item, quantity: item.quantity + input.quantity }
                  : item,
              ),
            },
          };
          queryClient.setQueryData(cartKeys.summary(), optimistic);
          cartStore.getState().updateItemQuantity(existing.id, existing.quantity + input.quantity);
        }
      }

      return { previous };
    },
    onSuccess: (data) => {
      queryClient.setQueryData(cartKeys.summary(), data);
      cartStore.getState().sync(data);
      queryClient.invalidateQueries({ queryKey: cartKeys.summary() }).catch(() => {});
      uiStore.getState().enqueueToast({
        variant: "success",
        title: "Sepete eklendi",
        description: "Ürün sepetinize başarıyla eklendi.",
      });
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(cartKeys.summary(), context.previous);
        cartStore.getState().sync(context.previous);
      }
      uiStore.getState().enqueueToast({
        variant: "error",
        title: "Sepete eklenemedi",
        description: error.message || "Ürün sepete eklenirken bir sorun oluştu.",
      });
    },
  });
};
