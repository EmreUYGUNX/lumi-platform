import { useMutation, useQueryClient } from "@tanstack/react-query";

import { trackAddToCart } from "@/lib/analytics/events";
import { apiClient } from "@/lib/api-client";
import { uiStore } from "@/store";
import type { MoneyDTO } from "@lumi/shared/dto";

import type { AddCartItemInput, CartItemWithProduct, CartSummaryView } from "../types/cart.types";
import { addCartItemInputSchema, cartSummaryViewSchema } from "../types/cart.types";
import { cartStore } from "../store/cart.store";
import { cartKeys } from "./cart.keys";

interface AddToCartContext {
  previous?: CartSummaryView;
}

type AddToCartPayload = AddCartItemInput & {
  product?: Partial<CartItemWithProduct["product"]> & {
    price: MoneyDTO;
    currency?: string;
    title: string;
    id: string;
    slug?: string;
  };
  variant?: CartItemWithProduct["variant"];
};

export const useAddToCart = () => {
  const queryClient = useQueryClient();

  return useMutation<CartSummaryView, Error, AddToCartPayload, AddToCartContext>({
    mutationKey: cartKeys.addItem(),
    mutationFn: async ({ product: _product, variant: _variant, ...input }) => {
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

      if (previous && !input.customization) {
        const existing = previous.cart.items.find(
          (item) => item.productVariantId === input.productVariantId && !item.customization,
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
    onSuccess: (data, variables) => {
      queryClient.setQueryData(cartKeys.summary(), data);
      cartStore.getState().sync(data);
      queryClient.invalidateQueries({ queryKey: cartKeys.summary() }).catch(() => {});
      uiStore.getState().enqueueToast({
        variant: "success",
        title: "Sepete eklendi",
        description: "Ürün sepetinize başarıyla eklendi.",
      });

      const addedItem =
        data.cart.items.find((item) => item.productVariantId === variables.productVariantId) ??
        data.cart.items.find((item) => item.product.id === variables.product?.id);

      if (addedItem) {
        trackAddToCart(addedItem, addedItem.quantity);
      } else if (variables.product && variables.variant) {
        trackAddToCart(
          {
            id: variables.product.id,
            title: variables.product.title,
            slug: variables.product.slug,
            sku:
              variables.variant.sku ??
              ("sku" in variables.product ? (variables.product.sku ?? undefined) : undefined),
            price: variables.product.price,
            currency: variables.product.currency ?? variables.product.price.currency,
            categories:
              "categories" in variables.product
                ? (variables.product as { categories?: { name?: string | null }[] }).categories
                : undefined,
            variantId: variables.variant.id,
          },
          variables.quantity,
        );
      }
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
