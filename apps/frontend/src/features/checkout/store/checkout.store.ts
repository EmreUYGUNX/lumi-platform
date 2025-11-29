/* eslint-disable unicorn/no-null */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type {
  CheckoutAddress,
  CheckoutOrderSnapshot,
  CheckoutStateSnapshot,
  CheckoutStep,
  ShippingMethod,
} from "../types/checkout.types";

const CHECKOUT_STORAGE_KEY = "lumi.checkout";
export const CHECKOUT_STEPS: CheckoutStep[] = ["shipping", "payment", "review"];

const createMemoryStorage = (): Storage => {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => {
      store.clear();
    },
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => {
      if (!Number.isInteger(index) || index < 0) {
        return null;
      }
      // eslint-disable-next-line security/detect-object-injection
      return [...store.keys()][index] ?? null;
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
};

const createSessionStorage = (): Storage => {
  if (typeof window === "undefined") {
    return createMemoryStorage();
  }
  try {
    return window.sessionStorage;
  } catch {
    return createMemoryStorage();
  }
};

const defaultState: CheckoutStateSnapshot = {
  step: "shipping",
  billingSameAsShipping: true,
  shippingMethod: "standard",
  shippingAddress: undefined,
  billingAddress: undefined,
  paymentMethod: undefined,
  notes: undefined,
  lastOrder: undefined,
};

const nextStep = (current: CheckoutStep): CheckoutStep => {
  const index = CHECKOUT_STEPS.indexOf(current);
  const safeIndex = index === -1 ? 0 : index;
  const target =
    CHECKOUT_STEPS[Math.min(safeIndex + 1, CHECKOUT_STEPS.length - 1)] ?? CHECKOUT_STEPS[0];
  return target as CheckoutStep;
};

const previousStep = (current: CheckoutStep): CheckoutStep => {
  const index = CHECKOUT_STEPS.indexOf(current);
  const safeIndex = index === -1 ? 0 : index;
  const target = CHECKOUT_STEPS[Math.max(safeIndex - 1, 0)] ?? CHECKOUT_STEPS[0];
  return target as CheckoutStep;
};

export type CheckoutState = CheckoutStateSnapshot;

export interface CheckoutActions {
  setStep: (step: CheckoutStep) => void;
  nextStep: () => void;
  prevStep: () => void;
  setShippingAddress: (address: CheckoutAddress) => void;
  setBillingAddress: (address?: CheckoutAddress) => void;
  setBillingSameAsShipping: (value: boolean) => void;
  setShippingMethod: (method: ShippingMethod) => void;
  setPaymentMethod: (method?: string) => void;
  setNotes: (notes?: string) => void;
  setLastOrder: (order?: CheckoutOrderSnapshot) => void;
  reset: () => void;
}

export type CheckoutStore = CheckoutState & CheckoutActions;

export const useCheckoutStore = create<CheckoutStore>()(
  persist(
    (set, _get) => ({
      ...defaultState,
      setStep: (step) => set({ step }),
      nextStep: () => set((state) => ({ step: nextStep(state.step) })),
      prevStep: () => set((state) => ({ step: previousStep(state.step) })),
      setShippingAddress: (address) =>
        set((state) => ({
          shippingAddress: address,
          billingAddress: state.billingSameAsShipping ? { ...address } : state.billingAddress,
        })),
      setBillingAddress: (address) => set({ billingAddress: address }),
      setBillingSameAsShipping: (value) =>
        set((state) => ({
          billingSameAsShipping: value,
          billingAddress: value ? state.shippingAddress : state.billingAddress,
        })),
      setShippingMethod: (method) => set({ shippingMethod: method }),
      setPaymentMethod: (method) => set({ paymentMethod: method }),
      setNotes: (notes) => set({ notes }),
      setLastOrder: (order) => set({ lastOrder: order }),
      reset: () => set(defaultState),
    }),
    {
      name: CHECKOUT_STORAGE_KEY,
      storage: createJSONStorage(createSessionStorage),
      partialize: (state) => ({
        step: state.step,
        shippingAddress: state.shippingAddress,
        billingAddress: state.billingAddress,
        billingSameAsShipping: state.billingSameAsShipping,
        shippingMethod: state.shippingMethod,
        paymentMethod: state.paymentMethod,
        notes: state.notes,
        lastOrder: state.lastOrder,
      }),
    },
  ),
);

export const checkoutStore = useCheckoutStore;
