import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { uiStore } from "@/store";

import type { AddCartItemInput, CartSummaryView } from "../types/cart.types";
import { addCartItemInputSchema, cartSummaryViewSchema } from "../types/cart.types";
import { cartKeys } from "./cart.keys";

export const useAddToCart = () => {
  const queryClient = useQueryClient();

  return useMutation<CartSummaryView, Error, AddCartItemInput>({
    mutationKey: cartKeys.addItem(),
    mutationFn: async (input) => {
      const payload = addCartItemInputSchema.parse(input);
      const response = await apiClient.post("/cart/items", {
        dataSchema: cartSummaryViewSchema,
        body: payload,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartKeys.summary() }).catch(() => {});
      uiStore.getState().enqueueToast({
        variant: "success",
        title: "Sepete eklendi",
        description: "Ürün sepetinize başarıyla eklendi.",
      });
    },
  });
};
