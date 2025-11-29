/* eslint-disable unicorn/no-null */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { MoneyDTO } from "@lumi/shared/dto";

import type { CartItemWithProduct, CartStockIssue, CartSummaryView } from "../types/cart.types";

const CART_STORAGE_KEY = "lumi.cart";
const ESTIMATED_TAX_RATE = 0.18;
const CART_ITEM_MAX_QUANTITY = 10;

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

const parseAmount = (money?: MoneyDTO): number => {
  if (!money) return 0;
  const normalised = money.amount.replace(",", ".");
  const parsed = Number.parseFloat(normalised);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toMoney = (amount: number, currency: string): MoneyDTO => ({
  amount: amount.toFixed(2),
  currency,
});

const calculateTotals = (
  items: CartItemWithProduct[],
  currency: string,
  overrides?: CartSummaryView["cart"]["totals"],
) => {
  const fallbackSubtotal = items.reduce(
    (sum, item) => sum + parseAmount(item.unitPrice) * item.quantity,
    0,
  );
  const subtotal = overrides?.subtotal ? parseAmount(overrides.subtotal) : fallbackSubtotal;
  const tax = overrides?.tax
    ? parseAmount(overrides.tax)
    : Number.parseFloat(Math.max(0, subtotal * ESTIMATED_TAX_RATE).toFixed(2));
  const discount = overrides?.discount ? parseAmount(overrides.discount) : 0;
  const total = overrides?.total
    ? parseAmount(overrides.total)
    : Number.parseFloat((subtotal + tax - discount).toFixed(2));

  return { subtotal, tax, discount, total };
};

const patchView = (
  view: CartSummaryView | undefined,
  items: CartItemWithProduct[],
  currency: string,
  totals: ReturnType<typeof calculateTotals>,
): CartSummaryView | undefined => {
  if (!view) return undefined;
  const now = new Date().toISOString();
  return {
    ...view,
    cart: {
      ...view.cart,
      items,
      totals: {
        subtotal: toMoney(totals.subtotal, currency),
        tax: toMoney(totals.tax, currency),
        discount: toMoney(totals.discount, currency),
        total: toMoney(totals.total, currency),
      },
      updatedAt: now,
    },
    stock: {
      ...view.stock,
      checkedAt: now,
    },
  };
};

const clampQuantity = (quantity: number, availableStock?: number) => {
  const stockCap =
    typeof availableStock === "number" && availableStock > 0
      ? Math.min(availableStock, CART_ITEM_MAX_QUANTITY)
      : CART_ITEM_MAX_QUANTITY;
  return Math.max(0, Math.min(stockCap, Math.round(quantity)));
};

export interface CartState {
  cartId?: string;
  items: CartItemWithProduct[];
  currency: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  itemCount: number;
  stockIssues: CartStockIssue[];
  deliveryMessage?: string;
  lastUpdated?: number;
  view?: CartSummaryView;
}

export interface CartActions {
  sync: (view: CartSummaryView) => void;
  addItem: (item: CartItemWithProduct) => void;
  updateItemQuantity: (itemId: string, quantity: number) => void;
  removeItem: (itemId: string) => void;
  clear: () => void;
}

export type CartStore = CartState & CartActions;

export const cartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      cartId: undefined,
      items: [],
      currency: "TRY",
      subtotal: 0,
      tax: 0,
      discount: 0,
      total: 0,
      itemCount: 0,
      stockIssues: [],
      deliveryMessage: undefined,
      lastUpdated: undefined,
      view: undefined,
      sync: (view) => {
        const {
          cart: { items: viewItems, totals: viewTotals, id: viewId },
          stock,
          delivery,
        } = view;
        const { currency } = viewTotals.total;
        const totals = calculateTotals(viewItems, currency, viewTotals);
        set({
          cartId: viewId,
          items: viewItems,
          currency,
          subtotal: totals.subtotal,
          tax: totals.tax,
          discount: totals.discount,
          total: totals.total,
          itemCount: viewItems.reduce((sum, item) => sum + item.quantity, 0),
          stockIssues: stock.issues,
          deliveryMessage: delivery.message,
          lastUpdated: Date.now(),
          view,
        });
      },
      addItem: (item) => {
        set((state) => {
          const existingIndex = state.items.findIndex(
            (entry) => entry.productVariantId === item.productVariantId,
          );
          const nextItems =
            existingIndex === -1
              ? [
                  ...state.items,
                  { ...item, quantity: clampQuantity(item.quantity, item.availableStock) },
                ]
              : state.items.map((entry, index) =>
                  index === existingIndex
                    ? {
                        ...entry,
                        quantity: clampQuantity(
                          entry.quantity + item.quantity,
                          entry.availableStock,
                        ),
                      }
                    : entry,
                );

          const currency = item.unitPrice.currency || state.currency;
          const totals = calculateTotals(nextItems, currency, state.view?.cart.totals);
          const itemCount = nextItems.reduce((sum, entry) => sum + entry.quantity, 0);

          return {
            cartId: state.cartId,
            items: nextItems,
            currency,
            subtotal: totals.subtotal,
            tax: totals.tax,
            discount: totals.discount,
            total: totals.total,
            itemCount,
            stockIssues: state.stockIssues,
            deliveryMessage: state.deliveryMessage,
            lastUpdated: Date.now(),
            view: patchView(state.view, nextItems, currency, totals),
          };
        });
      },
      updateItemQuantity: (itemId, quantity) => {
        set((state) => {
          const nextItems = state.items
            .map((item) =>
              item.id === itemId
                ? { ...item, quantity: clampQuantity(quantity, item.availableStock) }
                : item,
            )
            .filter((item) => item.quantity > 0);

          const totals = calculateTotals(nextItems, state.currency, state.view?.cart.totals);
          const itemCount = nextItems.reduce((sum, entry) => sum + entry.quantity, 0);

          return {
            ...state,
            items: nextItems,
            subtotal: totals.subtotal,
            tax: totals.tax,
            discount: totals.discount,
            total: totals.total,
            itemCount,
            lastUpdated: Date.now(),
            view: patchView(state.view, nextItems, state.currency, totals),
          };
        });
      },
      removeItem: (itemId) => {
        set((state) => {
          const nextItems = state.items.filter((item) => item.id !== itemId);
          const totals = calculateTotals(nextItems, state.currency, state.view?.cart.totals);
          const itemCount = nextItems.reduce((sum, entry) => sum + entry.quantity, 0);

          return {
            ...state,
            items: nextItems,
            subtotal: totals.subtotal,
            tax: totals.tax,
            discount: totals.discount,
            total: totals.total,
            itemCount,
            lastUpdated: Date.now(),
            view: patchView(state.view, nextItems, state.currency, totals),
          };
        });
      },
      clear: () => {
        const fallbackCurrency = get().currency || "TRY";
        return {
          cartId: undefined,
          items: [],
          currency: fallbackCurrency,
          subtotal: 0,
          tax: 0,
          discount: 0,
          total: 0,
          itemCount: 0,
          stockIssues: [],
          deliveryMessage: undefined,
          lastUpdated: Date.now(),
          view: undefined,
        };
      },
    }),
    {
      name: CART_STORAGE_KEY,
      storage: createJSONStorage(createSessionStorage),
      partialize: (state) => ({
        cartId: state.cartId,
        items: state.items,
        currency: state.currency,
        subtotal: state.subtotal,
        tax: state.tax,
        discount: state.discount,
        total: state.total,
        itemCount: state.itemCount,
        stockIssues: state.stockIssues,
        deliveryMessage: state.deliveryMessage,
        lastUpdated: state.lastUpdated,
        view: state.view,
      }),
    },
  ),
);

export const useCartStore = cartStore;
