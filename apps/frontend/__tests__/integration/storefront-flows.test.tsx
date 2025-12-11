import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

import type { CartItemWithProduct, CartSummaryView } from "@/features/cart/types/cart.types";
import type { ProductSummary } from "@/features/products/types/product.types";
import { cartKeys } from "@/features/cart/hooks/cart.keys";
import { useAddToCart } from "@/features/cart/hooks/useAddToCart";
import { useRemoveCartItem } from "@/features/cart/hooks/useRemoveCartItem";
import { useUpdateCartItem } from "@/features/cart/hooks/useUpdateCartItem";
import { cartStore } from "@/features/cart/store/cart.store";
import { useCheckout } from "@/features/checkout/hooks/useCheckout";
import { checkoutStore } from "@/features/checkout/store/checkout.store";
import { useProducts } from "@/features/products/hooks/useProducts";
import { apiClient } from "@/lib/api-client";

const timestamp = "2024-01-02T12:00:00.000Z";
const ids = {
  product: "c000000000000000000000301",
  variant: "c000000000000000000000302",
  category: "c000000000000000000000303",
  media: "c000000000000000000000304",
  cartId: "c000000000000000000000305",
  cartItem: "c000000000000000000000306",
};

const createWrapper = (client: QueryClient) => {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
};

const buildProduct = (overrides?: Partial<ProductSummary>): ProductSummary => ({
  id: ids.product,
  title: "Lumi Flow Jacket",
  slug: "lumi-flow-jacket",
  sku: "FLOW-JACKET",
  summary: "Flow test product",
  description: "Flow description",
  status: "ACTIVE",
  price: { amount: "980.00", currency: "TRY" },
  compareAtPrice: { amount: "1200.00", currency: "TRY" },
  currency: "TRY",
  inventoryPolicy: "TRACK",
  searchKeywords: ["flow", "jacket"],
  attributes: {},
  variants: [
    {
      id: ids.variant,
      title: "Default",
      sku: "FLOW-PRIMARY",
      price: { amount: "980.00", currency: "TRY" },
      compareAtPrice: { amount: "1200.00", currency: "TRY" },
      stock: 4,
      attributes: {},
      weightGrams: 480,
      isPrimary: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ],
  categories: [
    {
      id: ids.category,
      name: "Outerwear",
      slug: "outerwear",
      description: "Outerwear",
      parentId: ids.category,
      level: 0,
      path: "outerwear",
      imageUrl: "https://cdn.lumi.test/flow/outerwear.png",
      iconUrl: "https://cdn.lumi.test/flow/outerwear-icon.png",
      displayOrder: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ],
  media: [
    {
      productId: ids.product,
      mediaId: ids.media,
      sortOrder: 1,
      isPrimary: true,
      media: {
        id: ids.media,
        assetId: "asset_flow",
        url: "https://cdn.lumi.test/flow/jacket.jpg",
        type: "IMAGE",
        provider: "CLOUDINARY",
        mimeType: "image/jpeg",
        sizeBytes: 2048,
        width: 1200,
        height: 1600,
        alt: "Flow Jacket",
        caption: "Flow Jacket",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ],
  createdAt: timestamp,
  updatedAt: timestamp,
  deletedAt: timestamp,
  ...overrides,
});

const buildCartItem = (product: ProductSummary, quantity = 1): CartItemWithProduct => {
  const variant = product.variants[0];
  if (!variant) {
    throw new Error("Product requires at least one variant");
  }

  return {
    id: ids.cartItem,
    cartId: ids.cartId,
    productVariantId: variant.id,
    quantity,
    unitPrice: product.price,
    product: {
      id: product.id,
      title: product.title,
      slug: product.slug,
      status: product.status,
      inventoryPolicy: product.inventoryPolicy,
      price: product.price,
      compareAtPrice: product.compareAtPrice ?? undefined,
      currency: product.currency,
    },
    variant: {
      ...variant,
      price: product.price,
      compareAtPrice: product.compareAtPrice ?? variant.compareAtPrice ?? undefined,
    },
    availableStock: 8,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

const buildCartView = (items: CartItemWithProduct[]): CartSummaryView => {
  const subtotal = items.reduce(
    (sum, item) => sum + Number.parseFloat(item.unitPrice.amount) * item.quantity,
    0,
  );
  const tax = Number.parseFloat((subtotal * 0.18).toFixed(2));
  const total = subtotal + tax;
  return {
    cart: {
      id: ids.cartId,
      userId: ids.cartId,
      sessionId: "session_flow",
      status: "ACTIVE",
      expiresAt: timestamp,
      items,
      totals: {
        subtotal: { amount: subtotal.toFixed(2), currency: "TRY" },
        tax: { amount: tax.toFixed(2), currency: "TRY" },
        discount: { amount: "0.00", currency: "TRY" },
        total: { amount: total.toFixed(2), currency: "TRY" },
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
  };
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
  checkoutStore.getState().reset();
};

describe("Storefront integration flows", () => {
  beforeEach(() => {
    resetStores();
  });

  afterEach(() => {
    vi.clearAllMocks();
    resetStores();
  });

  it("loads the product catalog with search and sorting applied", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = createWrapper(client);
    const product = buildProduct();

    const getSpy = vi.spyOn(apiClient, "get").mockResolvedValue({
      data: [product],
      meta: {
        pagination: {
          page: 1,
          pageSize: 12,
          totalItems: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      },
    });

    const { result } = renderHook(
      () =>
        useProducts(
          {
            search: "lumi",
            sort: "rating",
            page: 1,
            pageSize: 12,
          },
          { enabled: true },
        ),
      { wrapper },
    );

    await waitFor(() => expect(result.current.data?.items[0]?.title).toBe(product.title));
    expect(getSpy).toHaveBeenCalledWith(
      "/catalog/products",
      expect.objectContaining({
        query: expect.objectContaining({ search: "lumi", sort: "rating" }),
      }),
    );
    expect(result.current.data?.items[0]?.slug).toBe("lumi-flow-jacket");
  });

  it("handles cart interactions from add to remove while keeping totals in sync", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const wrapper = createWrapper(client);
    const product = buildProduct();
    const cartItem = buildCartItem(product);
    const addView = buildCartView([cartItem]);
    const updatedView = buildCartView([{ ...cartItem, quantity: 2 }]);
    const emptyView = buildCartView([]);

    vi.spyOn(apiClient, "post").mockResolvedValue({ data: addView, meta: undefined });
    vi.spyOn(apiClient, "put").mockResolvedValue({ data: updatedView, meta: undefined });
    vi.spyOn(apiClient, "delete").mockResolvedValue({ data: emptyView, meta: undefined });

    const { result: addHook } = renderHook(() => useAddToCart(), { wrapper });

    await act(async () => {
      await addHook.current.mutateAsync({
        productVariantId: cartItem.productVariantId,
        quantity: 1,
        product: {
          id: product.id,
          title: product.title,
          slug: product.slug,
          price: product.price,
          currency: product.currency,
        },
        variant: cartItem.variant,
      });
    });

    expect(cartStore.getState().itemCount).toBe(1);
    client.setQueryData(cartKeys.summary(), addView);

    const { result: updateHook } = renderHook(() => useUpdateCartItem(), { wrapper });
    await act(async () => {
      await updateHook.current.mutateAsync({ itemId: cartItem.id, quantity: 2 });
    });

    expect(cartStore.getState().items[0]?.quantity).toBe(2);
    client.setQueryData(cartKeys.summary(), updatedView);

    const { result: removeHook } = renderHook(() => useRemoveCartItem(), { wrapper });
    await act(async () => {
      await removeHook.current.mutateAsync({ itemId: cartItem.id });
    });

    expect(cartStore.getState().items).toHaveLength(0);
  });

  it("advances checkout steps with validated shipping and review data", async () => {
    const { result } = renderHook(() => useCheckout());

    act(() => {
      result.current.updateShipping({
        address: {
          fullName: "Flow Customer",
          email: "flow@example.com",
          phone: "+905551112233",
          line1: "Test Street 1",
          city: "Istanbul",
          state: "Istanbul",
          postalCode: "34000",
          country: "TR",
        },
        method: "express",
      });
      result.current.setPaymentMethod("card");
    });

    expect(result.current.isShippingValid).toBe(true);

    act(() => {
      result.current.goToStep("review");
    });

    expect(result.current.step).toBe("review");
    expect(result.current.progress).toBeGreaterThanOrEqual(66);
  });
});
