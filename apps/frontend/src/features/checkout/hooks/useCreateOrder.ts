"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { useRouter } from "next/navigation";

import { orderDetailSchema, paymentSummarySchema } from "@lumi/shared/dto";
import { cartKeys } from "@/features/cart/hooks/cart.keys";
import { cartStore } from "@/features/cart/store/cart.store";
import { apiClient } from "@/lib/api-client";
import { trackPurchase } from "@/lib/analytics/events";
import { uiStore } from "@/store";

import { CHECKOUT_STEPS, checkoutStore } from "../store/checkout.store";
import type { CheckoutOrderSnapshot, ShippingMethod } from "../types/checkout.types";
import { checkoutNotesSchema, checkoutStepSchema } from "../types/checkout.types";
import { SHIPPING_METHODS, useCheckout } from "./useCheckout";

const createOrderResponseSchema = z
  .object({
    order: orderDetailSchema,
    payment: paymentSummarySchema.optional(),
  })
  .strict();

const emitCheckoutEvent = (event: string, payload?: Record<string, unknown>) => {
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
      // eslint-disable-next-line no-console -- surfaced only in development for observability
      console.info(`[checkout] ${event}`, payload);
    }
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console -- surfaced only in development for observability
      console.warn("[checkout] analytics emit failed", error);
    }
  }
};

const resolveShippingCost = (method?: ShippingMethod) =>
  SHIPPING_METHODS.find((entry) => entry.id === method)?.cost ?? 0;

const buildSnapshot = (params: {
  order: z.infer<typeof orderDetailSchema>;
  shippingMethod?: ShippingMethod;
}): CheckoutOrderSnapshot => {
  const { order, shippingMethod } = params;
  const estimatedDelivery =
    order.tracking?.estimatedDelivery ||
    (() => {
      const now = new Date();
      const fallbackDays = shippingMethod === "next_day" ? 1 : shippingMethod === "express" ? 3 : 6;
      now.setDate(now.getDate() + fallbackDays);
      return now.toISOString();
    })();

  return {
    id: order.id,
    reference: order.reference,
    total: order.totalAmount,
    estimatedDelivery,
    shippingMethod,
    createdAt: order.createdAt,
    items:
      order.items?.map((item) => ({
        id: item.id,
        title: item.titleSnapshot ?? item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })) ?? [],
  };
};

export const useCreateOrder = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { shippingAddress, shippingMethod, notes, setLastOrder, step } = useCheckout();

  return useMutation({
    mutationKey: ["checkout", "create-order"],
    mutationFn: async () => {
      const cartState = cartStore.getState();
      if (!cartState.cartId || cartState.items.length === 0) {
        throw new Error("Sepetiniz boş. Lütfen ürün ekleyin.");
      }

      if (!shippingAddress || !shippingMethod) {
        throw new Error("Teslimat bilgileri eksik.");
      }

      const payload = {
        cartId: cartState.cartId,
        shippingAddressId: shippingAddress.id,
        billingAddressId: checkoutStore.getState().billingSameAsShipping
          ? shippingAddress.id
          : checkoutStore.getState().billingAddress?.id,
        notes: checkoutNotesSchema.parse(notes),
        metadata: {
          shippingMethod,
          shippingCity: shippingAddress.city,
          shippingCountry: shippingAddress.country,
        },
      };

      const response = await apiClient.post("/orders", {
        dataSchema: createOrderResponseSchema,
        body: payload,
      });

      const shippingCost = resolveShippingCost(shippingMethod);
      emitCheckoutEvent("checkout.step", {
        step: step || checkoutStepSchema.Enum.shipping,
        shippingMethod,
        cartValue: cartState.total + shippingCost,
      });

      return response.data;
    },
    onSuccess: (data) => {
      const snapshot = buildSnapshot({ order: data.order, shippingMethod });
      cartStore.getState().clear();
      queryClient.invalidateQueries({ queryKey: cartKeys.summary() }).catch(() => {});

      checkoutStore.getState().reset();
      checkoutStore.getState().setLastOrder(snapshot);
      setLastOrder(snapshot);

      emitCheckoutEvent("checkout.order.created", {
        orderId: data.order.id,
        reference: data.order.reference,
        total: data.order.totalAmount.amount,
        currency: data.order.totalAmount.currency,
        shippingMethod,
        step: CHECKOUT_STEPS.at(-1),
      });

      trackPurchase({
        id: data.order.id,
        reference: data.order.reference,
        totalAmount: data.order.totalAmount,
        items: data.order.items,
      });

      router.push("/checkout/success");
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : "Sipariş oluşturulurken bir sorun oluştu.";
      uiStore.getState().enqueueToast({
        variant: "error",
        title: "Sipariş oluşturulamadı",
        description: message,
      });
    },
  });
};
