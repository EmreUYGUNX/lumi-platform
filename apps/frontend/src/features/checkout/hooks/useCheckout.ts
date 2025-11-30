import { useMemo } from "react";

import { sessionStore } from "@/store/session";

import { CHECKOUT_STEPS, checkoutStore, useCheckoutStore } from "../store/checkout.store";
import type { CheckoutAddress, CheckoutStep, ShippingMethod } from "../types/checkout.types";
import {
  checkoutAddressSchema,
  checkoutNotesSchema,
  shippingMethodSchema,
} from "../types/checkout.types";

export const SHIPPING_METHODS: {
  id: ShippingMethod;
  label: string;
  description: string;
  eta: string;
  cost: number;
}[] = [
  {
    id: "standard",
    label: "Standard",
    description: "5-7 gün içinde teslimat",
    eta: "5-7 gün",
    cost: 0,
  },
  {
    id: "express",
    label: "Express",
    description: "2-3 gün içinde hızlandırılmış teslimat",
    eta: "2-3 gün",
    cost: 20,
  },
  {
    id: "next_day",
    label: "Next Day",
    description: "Ertesi gün kapında",
    eta: "1 gün",
    cost: 40,
  },
];

const buildShippingSchema = (requireEmail: boolean) =>
  checkoutAddressSchema.extend({
    email: requireEmail
      ? checkoutAddressSchema.shape.email
      : checkoutAddressSchema.shape.email.optional(),
  });

const parseShipping = (
  address: CheckoutAddress | undefined,
  method: ShippingMethod | undefined,
  requireEmail: boolean,
) => {
  if (!address || !method) return { success: false as const };
  const parsedAddress = buildShippingSchema(requireEmail).safeParse(address);
  const parsedMethod = shippingMethodSchema.safeParse(method);
  return {
    success: parsedAddress.success && parsedMethod.success,
    addressResult: parsedAddress,
    methodResult: parsedMethod,
  };
};

export const useCheckout = () => {
  const step = useCheckoutStore((state) => state.step);
  const shippingAddress = useCheckoutStore((state) => state.shippingAddress);
  const billingAddress = useCheckoutStore((state) => state.billingAddress);
  const billingSameAsShipping = useCheckoutStore((state) => state.billingSameAsShipping);
  const shippingMethod = useCheckoutStore((state) => state.shippingMethod);
  const paymentMethod = useCheckoutStore((state) => state.paymentMethod);
  const notes = useCheckoutStore((state) => state.notes);
  const lastOrder = useCheckoutStore((state) => state.lastOrder);

  const setStep = useCheckoutStore((state) => state.setStep);
  const goPrev = useCheckoutStore((state) => state.prevStep);
  const setShippingAddress = useCheckoutStore((state) => state.setShippingAddress);
  const setBillingAddress = useCheckoutStore((state) => state.setBillingAddress);
  const setBillingSameAsShipping = useCheckoutStore((state) => state.setBillingSameAsShipping);
  const setShippingMethod = useCheckoutStore((state) => state.setShippingMethod);
  const setPaymentMethod = useCheckoutStore((state) => state.setPaymentMethod);
  const setNotes = useCheckoutStore((state) => state.setNotes);
  const setLastOrder = useCheckoutStore((state) => state.setLastOrder);
  const reset = useCheckoutStore((state) => state.reset);

  const isAuthenticated = sessionStore((session) => session.isAuthenticated);

  const shippingValidation = useMemo(
    () => parseShipping(shippingAddress, shippingMethod, !isAuthenticated),
    [shippingAddress, shippingMethod, isAuthenticated],
  );

  const isShippingValid = shippingValidation.success;

  const validateStep = (target: CheckoutStep): boolean => {
    switch (target) {
      case "shipping": {
        return isShippingValid;
      }
      case "payment": {
        return isShippingValid;
      }
      case "review": {
        return isShippingValid;
      }
      default: {
        return false;
      }
    }
  };

  const canNavigateTo = (target: CheckoutStep): boolean => {
    if (target === "shipping") return true;
    return validateStep("shipping") && CHECKOUT_STEPS.includes(target);
  };

  const progress = useMemo(() => {
    const activeIndex = Math.max(CHECKOUT_STEPS.indexOf(step), 0);
    const checkpoints = [
      isShippingValid ? 1 : 0,
      activeIndex >= 1 ? 1 : 0,
      activeIndex >= 2 ? 1 : 0,
    ];
    const completed = checkpoints.reduce((sum, value) => sum + value, 0);
    return Math.round((completed / CHECKOUT_STEPS.length) * 100);
  }, [step, isShippingValid]);

  const updateShipping = (payload: { address: CheckoutAddress; method: ShippingMethod }) => {
    setShippingAddress(payload.address);
    setShippingMethod(payload.method);
    if (billingSameAsShipping) {
      setBillingAddress(payload.address);
    }
  };

  const setOrderNotes = (value?: string) => {
    const parsed = checkoutNotesSchema.safeParse(typeof value === "string" ? value.trim() : value);
    setNotes(parsed.success ? parsed.data : undefined);
  };

  const goToStep = (target: CheckoutStep): boolean => {
    if (!canNavigateTo(target)) {
      return false;
    }
    setStep(target);
    return true;
  };

  const advance = (): boolean => {
    const nextIndex = Math.min(CHECKOUT_STEPS.indexOf(step) + 1, CHECKOUT_STEPS.length - 1);
    // eslint-disable-next-line security/detect-object-injection -- CHECKOUT_STEPS is a trusted constant list
    const target = (CHECKOUT_STEPS[nextIndex] ?? CHECKOUT_STEPS.at(-1)) as CheckoutStep;
    if (!canNavigateTo(target)) {
      return false;
    }
    if (target === step) {
      return true;
    }
    setStep(target);
    return true;
  };

  const retreat = () => {
    goPrev();
  };

  const clearState = () => {
    checkoutStore.persist?.clearStorage?.();
    reset();
  };

  return {
    step,
    steps: CHECKOUT_STEPS,
    shippingAddress,
    billingAddress,
    billingSameAsShipping,
    shippingMethod,
    paymentMethod,
    notes,
    lastOrder,
    isShippingValid,
    progress,
    updateShipping,
    setShippingMethod,
    setShippingAddress,
    setBillingAddress,
    setBillingSameAsShipping,
    setPaymentMethod,
    setOrderNotes,
    setLastOrder,
    setStep,
    goNext: advance,
    goPrev: retreat,
    goToStep,
    canNavigateTo,
    validateStep,
    clearState,
  };
};
