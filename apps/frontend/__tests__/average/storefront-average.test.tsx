import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, renderHook, waitFor, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

import { ProductCard } from "@/features/catalog/components/ProductCard";
import { useAddToCart } from "@/features/cart/hooks/useAddToCart";
import { cartKeys } from "@/features/cart/hooks/cart.keys";
import { cartStore } from "@/features/cart/store/cart.store";
import { CartSummary } from "@/features/cart/components/CartSummary";
import type { CartItemWithProduct, CartSummaryView } from "@/features/cart/types/cart.types";
import { useProducts } from "@/features/products/hooks/useProducts";
import type { ProductSummary } from "@/features/products/types/product.types";
import { resolveProductMedia } from "@/features/products/utils/product-helpers";
import { useProductFilters } from "@/features/catalog/hooks/useProductFilters";
import { uiStore } from "@/store";
import { checkoutStore } from "@/features/checkout/store/checkout.store";
import { apiClient } from "@/lib/api-client";

const timestamp = "2024-01-02T12:00:00.000Z";
const ids = {
  product: "c000000000000000000000401",
  variant: "c000000000000000000000402",
  category: "c000000000000000000000403",
  media: "c000000000000000000000404",
  cartId: "c000000000000000000000405",
  cartItem: "c000000000000000000000406",
};

const createWrapper = (client: QueryClient) => {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
};

const buildProduct = (overrides?: Partial<ProductSummary>): ProductSummary => ({
  id: ids.product,
  title: "Average Flow Sneaker",
  slug: "average-flow-sneaker",
  sku: "AVG-SNK",
  summary: "Average path product",
  description: "Balanced path product",
  status: "ACTIVE",
  price: { amount: "450.00", currency: "TRY" },
  compareAtPrice: { amount: "520.00", currency: "TRY" },
  currency: "TRY",
  inventoryPolicy: "TRACK",
  searchKeywords: ["average", "sneaker"],
  attributes: {},
  variants: [
    {
      id: ids.variant,
      title: "Default",
      sku: "AVG-DEFAULT",
      price: { amount: "450.00", currency: "TRY" },
      compareAtPrice: { amount: "520.00", currency: "TRY" },
      stock: 6,
      attributes: {},
      weightGrams: 300,
      isPrimary: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ],
  categories: [
    {
      id: ids.category,
      name: "Footwear",
      slug: "footwear",
      description: "Footwear",
      parentId: ids.category,
      level: 0,
      path: "footwear",
      imageUrl: "https://cdn.lumi.test/average/footwear.png",
      iconUrl: "https://cdn.lumi.test/average/footwear-icon.png",
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
        assetId: "asset_avg",
        url: "https://cdn.lumi.test/average/sneaker.jpg",
        type: "IMAGE",
        provider: "CLOUDINARY",
        mimeType: "image/jpeg",
        sizeBytes: 1024,
        width: 1200,
        height: 1200,
        alt: "Average Sneaker",
        caption: "Average Sneaker",
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
    availableStock: 6,
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
      sessionId: "session_avg",
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
  uiStore.setState({ toastQueue: [] });
  checkoutStore.getState().reset();
  useProductFilters.setState({
    search: "",
    categorySlug: undefined,
    categoryLabel: undefined,
    sort: "featured",
    page: 1,
    pageSize: 24,
    viewMode: "paged",
    priceRange: {},
    attributes: {},
    availability: undefined,
    brands: [],
    rating: undefined,
  });
};

describe("Storefront average/error/recovery scenarios", () => {
  beforeEach(() => {
    resetStores();
  });

  afterEach(() => {
    vi.clearAllMocks();
    resetStores();
  });

  it("completes the happy path journey within SLA", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = createWrapper(client);
    const product = buildProduct();
    const cartView = buildCartView([buildCartItem(product)]);

    vi.spyOn(apiClient, "get").mockResolvedValue({
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
    vi.spyOn(apiClient, "post").mockResolvedValue({ data: cartView, meta: undefined });

    const start = performance.now();
    const { result: productsResult } = renderHook(
      () => useProducts({ search: "average" }, { enabled: true }),
      { wrapper },
    );

    await waitFor(() => expect(productsResult.current.data?.items[0]).toBeDefined());

    const { result: addHook } = renderHook(() => useAddToCart(), { wrapper });
    await act(async () => {
      await addHook.current.mutateAsync({
        productVariantId: product.variants[0]!.id,
        quantity: 1,
        product: {
          id: product.id,
          title: product.title,
          slug: product.slug,
          price: product.price,
          currency: product.currency,
        },
        variant: product.variants[0]!,
      });
    });

    const duration = performance.now() - start;
    expect(duration).toBeLessThan(2000);
    expect(cartStore.getState().items[0]?.product.title).toBe(product.title);
    const media = resolveProductMedia(product);
    expect(media.src).toMatch(/^https?:\/\//u);
  });

  it("blocks out of stock quick add actions", async () => {
    const product = buildProduct({
      variants: [
        {
          ...buildProduct().variants[0]!,
          stock: 0,
          id: "cvar_out",
          isPrimary: true,
        },
      ],
    });

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={client}>
        <ProductCard product={product} />
      </QueryClientProvider>,
    );

    const quickAdd = screen.getByRole("button", { name: /sold out/i });
    expect(quickAdd).toBeDisabled();
  });

  it("keeps loading state during network timeouts", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = createWrapper(client);
    vi.useFakeTimers();
    vi.spyOn(apiClient, "get").mockReturnValue(new Promise(() => {}) as never);

    const { result } = renderHook(() => useProducts({ search: "timeout" }), { wrapper });

    expect(result.current.isLoading).toBe(true);
    vi.advanceTimersByTime(10_000);
    expect(result.current.isLoading).toBe(true);
    vi.useRealTimers();
  });

  it("rolls back optimistic state when the backend rejects a cart update", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = createWrapper(client);
    const product = buildProduct();
    const cartItem = buildCartItem(product, 1);
    const existingView = buildCartView([cartItem]);

    cartStore.getState().sync(existingView);
    client.setQueryData(cartKeys.summary(), existingView);
    vi.spyOn(apiClient, "post").mockRejectedValue(new Error("Price mismatch"));

    const { result } = renderHook(() => useAddToCart(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          productVariantId: cartItem.productVariantId,
          quantity: 2,
        }),
      ).rejects.toThrow("Price mismatch");
    });

    expect(cartStore.getState().items[0]?.quantity).toBe(1);
    const errorToast = uiStore.getState().toastQueue.find((toast) => toast.variant === "error");
    expect(errorToast?.title ?? "").toContain("Sepete eklenemedi");
  });

  it("shows a warning when an invalid promo code is submitted", async () => {
    const user = userEvent.setup();

    render(<CartSummary subtotal={100} tax={18} discount={0} total={118} currency="TRY" />);

    const input = screen.getByPlaceholderText(/promo code/i);
    await user.type(input, "   ");
    await user.click(screen.getByRole("button", { name: /apply/i }));

    const [toast] = uiStore.getState().toastQueue;
    expect(toast?.variant).toBe("warning");
  });

  it("recovers cart and checkout state after reconnect or refresh", async () => {
    const product = buildProduct();
    const cartItem = buildCartItem(product, 2);
    const view = buildCartView([cartItem]);
    cartStore.getState().sync(view);

    const checkoutPersist = checkoutStore.persist;
    const storageKey = "lumi.checkout";

    act(() => {
      checkoutStore.getState().setShippingMethod("express");
      checkoutStore.getState().setShippingAddress({
        fullName: "Recovery User",
        email: "recovery@example.com",
        phone: "+905551112233",
        line1: "Recovery Street 5",
        city: "Ankara",
        state: "Ankara",
        postalCode: "06000",
        country: "TR",
      });
      checkoutStore.getState().setPaymentMethod("card");
      checkoutStore.getState().setStep("review");
    });

    const persistedSnapshot = window.sessionStorage.getItem(storageKey);
    checkoutStore.setState(
      {
        step: "shipping",
        shippingAddress: undefined,
        billingAddress: undefined,
        billingSameAsShipping: true,
        shippingMethod: "standard",
        paymentMethod: undefined,
        notes: undefined,
        lastOrder: undefined,
      },
      false,
    );
    if (persistedSnapshot) {
      window.sessionStorage.setItem(storageKey, persistedSnapshot);
    }

    cartStore.setState({
      cartId: undefined,
      items: [],
      subtotal: 0,
      tax: 0,
      discount: 0,
      total: 0,
      itemCount: 0,
      currency: "TRY",
      stockIssues: [],
      deliveryMessage: undefined,
      lastUpdated: undefined,
      view: undefined,
    });

    await checkoutPersist?.rehydrate();
    expect(checkoutStore.getState().shippingAddress?.city).toBe("Ankara");
    expect(checkoutStore.getState().step).toBe("review");

    expect(cartStore.getState().items).toHaveLength(0);
    cartStore.getState().sync(view);
    expect(cartStore.getState().items[0]?.quantity).toBe(2);
  });
});
