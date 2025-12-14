import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { cuidSchema } from "@lumi/shared/dto";
import { apiClient } from "@/lib/api-client";
import { uiStore } from "@/store";

import type { CartSummaryView } from "../types/cart.types";
import { cartItemCustomizationInputSchema, cartSummaryViewSchema } from "../types/cart.types";
import { cartStore } from "../store/cart.store";
import { cartKeys } from "./cart.keys";

const updateCartItemInputSchema = z.object({
  itemId: cuidSchema,
  quantity: z.number().int().min(0).max(10),
  customization: z.union([cartItemCustomizationInputSchema, z.null()]).optional(),
});

interface UpdateCartContext {
  previous?: CartSummaryView;
}

export const useUpdateCartItem = () => {
  const queryClient = useQueryClient();

  return useMutation<
    CartSummaryView,
    Error,
    z.infer<typeof updateCartItemInputSchema>,
    UpdateCartContext
  >({
    mutationKey: cartKeys.items(),
    mutationFn: async (input) => {
      const payload = updateCartItemInputSchema.parse(input);
      const existing = cartStore.getState().items.find((item) => item.id === payload.itemId);
      if (existing && payload.quantity > existing.availableStock && existing.availableStock > 0) {
        throw new Error("Stokta yeterli ürün yok.");
      }

      const response = await apiClient.put(`/cart/items/${payload.itemId}`, {
        dataSchema: cartSummaryViewSchema,
        body: {
          quantity: payload.quantity,
          ...(payload.customization === undefined ? {} : { customization: payload.customization }),
        },
      });
      return response.data;
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: cartKeys.summary() });
      const parsed = updateCartItemInputSchema.safeParse(input);
      const previous = queryClient.getQueryData<CartSummaryView>(cartKeys.summary());

      if (parsed.success && previous) {
        const nextItems =
          parsed.data.quantity <= 0
            ? previous.cart.items.filter((item) => item.id !== parsed.data.itemId)
            : previous.cart.items.map((item) => {
                return item.id === parsed.data.itemId
                  ? {
                      ...item,
                      quantity: parsed.data.quantity,
                      ...(parsed.data.customization === null ? { customization: undefined } : {}),
                    }
                  : item;
              });

        const optimistic = {
          ...previous,
          cart: {
            ...previous.cart,
            items: nextItems,
          },
        };
        queryClient.setQueryData(cartKeys.summary(), optimistic);
      }

      if (parsed.success) {
        cartStore.getState().updateItemQuantity(parsed.data.itemId, parsed.data.quantity);
      }

      return { previous };
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData(cartKeys.summary(), data);
      cartStore.getState().sync(data);
      uiStore.getState().enqueueToast({
        variant: "success",
        title: "Sepet güncellendi",
        description:
          variables.customization === null
            ? "Tasarım kaldırıldı."
            : variables.customization
              ? "Tasarım güncellendi."
              : "Ürün miktarı güncellendi.",
      });
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(cartKeys.summary(), context.previous);
        cartStore.getState().sync(context.previous);
      }
      uiStore.getState().enqueueToast({
        variant: "error",
        title: "Güncelleme başarısız",
        description: error.message ?? "Ürün miktarı güncellenemedi.",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: cartKeys.summary() }).catch(() => {});
    },
  });
};
