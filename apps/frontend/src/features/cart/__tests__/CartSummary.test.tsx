/* eslint-disable unicorn/no-null */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

import type { CartItemWithProduct, CartSummaryView } from "@/features/cart/types/cart.types";
import { formatMoney } from "@/lib/formatters/price";
import { cartStore } from "@/features/cart/store/cart.store";
import { uiStore } from "@/store";
import type * as AnalyticsEvents from "@/lib/analytics/events";

import { CartSummary } from "../components/CartSummary";

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, ...props }: { children: React.ReactNode }) => (
    <span {...props}>{children}</span>
  ),
}));

vi.mock("@/lib/analytics/events", async (importOriginal) => {
  const actual = (await importOriginal()) as typeof AnalyticsEvents;
  return {
    ...actual,
    trackCheckoutStarted: vi.fn(),
  };
});

const timestamp = "2024-01-02T12:00:00.000Z";
const ids = {
  cartId: "c000000000000000000000101",
  cartItemId: "c000000000000000000000102",
  productId: "c000000000000000000000103",
  variantId: "c000000000000000000000104",
  categoryId: "c000000000000000000000105",
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

const buildCartView = (items: CartItemWithProduct[]): CartSummaryView => ({
  cart: {
    id: ids.cartId,
    userId: null,
    sessionId: null,
    status: "ACTIVE",
    expiresAt: null,
    items,
    totals: {
      subtotal: { amount: "120.00", currency: "TRY" },
      tax: { amount: "21.60", currency: "TRY" },
      discount: { amount: "10.00", currency: "TRY" },
      total: { amount: "131.60", currency: "TRY" },
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
});

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

describe("CartSummary component", () => {
  beforeEach(() => {
    resetStores();
  });

  afterEach(() => {
    vi.clearAllMocks();
    resetStores();
  });

  it("renders formatted totals and delivery messaging", () => {
    const subtotal = 120;
    const tax = 21.6;
    const discount = 10;
    const total = 131.6;

    render(
      <CartSummary
        subtotal={subtotal}
        tax={tax}
        discount={discount}
        total={total}
        currency="TRY"
        deliveryMessage="Ships in 1-3 days"
      />,
    );

    expect(
      screen.getByText(formatMoney({ amount: subtotal.toFixed(2), currency: "TRY" })),
    ).toBeInTheDocument();
    expect(
      screen.getByText(formatMoney({ amount: tax.toFixed(2), currency: "TRY" })),
    ).toBeInTheDocument();
    expect(
      screen.getByText(formatMoney({ amount: discount.toFixed(2), currency: "TRY" })),
    ).toBeInTheDocument();
    expect(
      screen.getByText(formatMoney({ amount: total.toFixed(2), currency: "TRY" })),
    ).toBeInTheDocument();
    expect(screen.getByText(/ships in 1-3 days/i)).toBeInTheDocument();
  });

  it("tracks checkout and invokes callback when proceeding to checkout", async () => {
    const user = userEvent.setup();
    const view = buildCartView([buildCartItem()]);
    cartStore.getState().sync(view);

    const onCheckout = vi.fn();
    const { trackCheckoutStarted } = await import("@/lib/analytics/events");

    render(
      <CartSummary
        subtotal={120}
        tax={21.6}
        discount={10}
        total={131.6}
        currency="TRY"
        onCheckout={onCheckout}
        checkoutLabel="Proceed to checkout"
      />,
    );

    await user.click(screen.getByText(/proceed to checkout/i));

    expect(onCheckout).toHaveBeenCalledTimes(1);
    expect(trackCheckoutStarted).toHaveBeenCalledWith(131.6, view.cart.items);
  });

  it("warns when an empty promo code is submitted", async () => {
    const user = userEvent.setup();
    render(<CartSummary subtotal={120} tax={21.6} discount={0} total={141.6} currency="TRY" />);

    await user.click(screen.getByRole("button", { name: /apply/i }));

    const [toast] = uiStore.getState().toastQueue;
    expect(toast?.variant).toBe("warning");
    expect(toast?.title).toContain("Kupon");
  });
});
