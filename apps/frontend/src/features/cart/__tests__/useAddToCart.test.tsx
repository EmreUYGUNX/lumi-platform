/* eslint-disable unicorn/no-null */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

import { cartStore } from "@/features/cart/store/cart.store";
import { cartKeys } from "@/features/cart/hooks/cart.keys";
import { apiClient } from "@/lib/api-client";
import { trackAddToCart } from "@/lib/analytics/events";
import { uiStore } from "@/store";
import type * as AnalyticsEvents from "@/lib/analytics/events";

import type { CartItemWithProduct, CartSummaryView } from "../types/cart.types";
import { useAddToCart } from "../hooks/useAddToCart";

vi.mock("@/lib/analytics/events", async (importOriginal) => {
  const actual = (await importOriginal()) as typeof AnalyticsEvents;
  return {
    ...actual,
    trackAddToCart: vi.fn(),
  };
});

const timestamp = "2024-01-02T12:00:00.000Z";
const ids = {
  cartId: "c000000000000000000000201",
  cartItemId: "c000000000000000000000202",
  productId: "c000000000000000000000203",
  variantId: "c000000000000000000000204",
  categoryId: "c000000000000000000000205",
};

const buildCartItem = (overrides?: Partial<CartItemWithProduct>): CartItemWithProduct => ({
  id: ids.cartItemId,
  cartId: ids.cartId,
  productVariantId: ids.variantId,
  quantity: 1,
  unitPrice: { amount: "120.00", currency: "TRY" },
  product: {
    id: ids.productId,
    title: "Lumi Tee",
    slug: "lumi-tee",
    status: "ACTIVE",
    inventoryPolicy: "TRACK",
    price: { amount: "120.00", currency: "TRY" },
    compareAtPrice: undefined,
    currency: "TRY",
  },
  variant: {
    id: ids.variantId,
    title: "Standard",
    sku: "SKU-123",
    price: { amount: "120.00", currency: "TRY" },
    stock: 5,
    attributes: null,
    weightGrams: null,
    isPrimary: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  availableStock: 10,
  createdAt: timestamp,
  updatedAt: timestamp,
  ...overrides,
});

const buildCartView = (
  item: CartItemWithProduct,
  overrides?: Partial<CartSummaryView>,
): CartSummaryView => ({
  cart: {
    id: ids.cartId,
    userId: null,
    sessionId: null,
    status: "ACTIVE",
    expiresAt: null,
    items: [item],
    totals: {
      subtotal: { amount: (item.quantity * 120).toFixed(2), currency: "TRY" },
      tax: { amount: "21.60", currency: "TRY" },
      discount: { amount: "0.00", currency: "TRY" },
      total: { amount: (item.quantity * 120 + 21.6).toFixed(2), currency: "TRY" },
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  stock: { status: "ok", issues: [], checkedAt: timestamp },
  delivery: {
    status: "standard",
    minHours: 24,
    maxHours: 72,
    estimatedDeliveryDate: undefined,
    message: "Ships in 1-3 days",
  },
  ...overrides,
});

const createWrapper = (queryClient: QueryClient) => {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const resetStores = () => {
  cartStore.setState({
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
  });
  uiStore.setState({ toastQueue: [] });
};

describe("useAddToCart hook", () => {
  beforeEach(() => {
    resetStores();
  });

  afterEach(() => {
    vi.clearAllMocks();
    resetStores();
  });

  it("adds a new item and synchronizes cart state with the server response", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = createWrapper(queryClient);
    const item = buildCartItem();
    const view = buildCartView(item);

    const postSpy = vi.spyOn(apiClient, "post").mockResolvedValue({ data: view, meta: undefined });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useAddToCart(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        productVariantId: item.productVariantId,
        quantity: 1,
        product: {
          id: item.product.id,
          title: item.product.title,
          slug: item.product.slug,
          price: item.product.price,
          currency: "TRY",
        },
        variant: item.variant,
      });
    });

    await waitFor(() => expect(cartStore.getState().items).toHaveLength(1));
    expect(cartStore.getState().total).toBeCloseTo(141.6);
    expect(postSpy).toHaveBeenCalledWith(
      "/cart/items",
      expect.objectContaining({
        body: { productVariantId: item.productVariantId, quantity: 1 },
      }),
    );
    expect(trackAddToCart).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData<CartSummaryView>(cartKeys.summary())).toMatchObject(view);
    expect(invalidateSpy).toHaveBeenCalled();
    const successToast = uiStore.getState().toastQueue.find((toast) => toast.variant === "success");
    expect(successToast).toBeDefined();
  });

  it("optimistically increments quantity when the item already exists", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = createWrapper(queryClient);
    const existingItem = buildCartItem({ quantity: 1 });
    const existingView = buildCartView(existingItem);

    cartStore.getState().sync(existingView);
    queryClient.setQueryData(cartKeys.summary(), existingView);

    const updatedView = buildCartView({ ...existingItem, quantity: 3 });
    vi.spyOn(apiClient, "post").mockResolvedValue({ data: updatedView, meta: undefined });

    const { result } = renderHook(() => useAddToCart(), { wrapper });

    await act(async () => {
      const mutation = result.current.mutateAsync({
        productVariantId: existingItem.productVariantId,
        quantity: 2,
        product: {
          id: existingItem.product.id,
          title: existingItem.product.title,
          slug: existingItem.product.slug,
          price: existingItem.product.price,
          currency: "TRY",
        },
        variant: existingItem.variant,
      });
      await waitFor(() => expect(cartStore.getState().items[0]?.quantity).toBe(3));
      await mutation;
    });

    expect(
      queryClient.getQueryData<CartSummaryView>(cartKeys.summary())?.cart.items[0]?.quantity,
    ).toBe(3);
  });

  it("rolls back to the previous state and surfaces an error toast on failure", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = createWrapper(queryClient);
    const existingItem = buildCartItem({ quantity: 1 });
    const existingView = buildCartView(existingItem);

    cartStore.getState().sync(existingView);
    queryClient.setQueryData(cartKeys.summary(), existingView);

    vi.spyOn(apiClient, "post").mockRejectedValue(new Error("Price mismatch"));

    const { result } = renderHook(() => useAddToCart(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          productVariantId: existingItem.productVariantId,
          quantity: 2,
        }),
      ).rejects.toThrow("Price mismatch");
    });

    expect(queryClient.getQueryData<CartSummaryView>(cartKeys.summary())).toMatchObject(
      existingView,
    );
    expect(cartStore.getState().items[0]?.quantity).toBe(1);
    const errorToast = uiStore.getState().toastQueue.find((toast) => toast.variant === "error");
    expect(errorToast?.title ?? "").toContain("Sepete eklenemedi");
  });
});
