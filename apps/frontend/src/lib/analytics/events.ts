/* eslint-disable import/order */

import type { MoneyDTO, OrderDetailDTO, OrderItemDTO, ProductSummaryDTO } from "@lumi/shared/dto";

import type { CartItemWithProduct } from "@/features/cart/types/cart.types";
import { env } from "@/lib/env";
import { addSentryBreadcrumb } from "./sentry";

type AnalyticsPayload = Record<string, unknown>;

export interface AnalyticsProductInput {
  id: string;
  title: string;
  slug?: string | null;
  sku?: string | null;
  price: MoneyDTO;
  currency?: string;
  categories?: { name?: string | null }[];
  variantId?: string;
  quantity?: number;
}

const parseAmount = (money?: MoneyDTO): number => {
  if (!money) return 0;
  const normalized = money.amount.replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const hasSku = (
  input: Partial<AnalyticsProductInput> | CartItemWithProduct | ProductSummaryDTO,
): input is { sku?: string | null } => "sku" in input;

const hasCategories = (
  input: Partial<AnalyticsProductInput> | CartItemWithProduct | ProductSummaryDTO,
): input is { categories?: { name?: string | null }[] } => "categories" in input;

const isCartItemWithProduct = (input: unknown): input is CartItemWithProduct => {
  return Boolean(
    input &&
      typeof input === "object" &&
      "product" in input &&
      "variant" in input &&
      "unitPrice" in input,
  );
};

const isProductLike = (input: unknown): input is AnalyticsProductInput | ProductSummaryDTO => {
  return Boolean(
    input &&
      typeof input === "object" &&
      !isCartItemWithProduct(input) &&
      "price" in input &&
      "title" in input &&
      "id" in input,
  );
};

const resolveSku = (
  variantSku: string | null | undefined,
  product?: Partial<AnalyticsProductInput>,
  slug?: string | null,
): string | undefined => {
  if (variantSku) return variantSku;
  if (product && hasSku(product)) return product.sku ?? undefined;
  return slug ?? undefined;
};

const buildCartAnalyticsProduct = (input: CartItemWithProduct): AnalyticsProductInput => {
  const categories = hasCategories(input.product) ? input.product.categories : undefined;

  return {
    id: input.product.id,
    title: input.product.title,
    slug: input.product.slug,
    sku: resolveSku(input.variant.sku, input.product, input.product.slug),
    price: input.unitPrice,
    currency: input.unitPrice.currency ?? input.product.currency,
    categories,
    variantId: input.variant.id,
    quantity: input.quantity,
  };
};

const buildProductAnalyticsProduct = (
  input: AnalyticsProductInput | ProductSummaryDTO,
): AnalyticsProductInput => {
  const candidate = input as Partial<AnalyticsProductInput>;
  return {
    id: input.id,
    title: input.title,
    slug: input.slug,
    sku: hasSku(candidate) ? (candidate.sku ?? undefined) : undefined,
    price: input.price,
    currency: "currency" in input ? input.currency : undefined,
    categories: hasCategories(candidate) ? candidate.categories : undefined,
    quantity: "quantity" in input ? (input as { quantity?: number }).quantity : undefined,
  };
};

const sanitizePayload = (payload: AnalyticsPayload): AnalyticsPayload =>
  Object.fromEntries(
    Object.entries(payload).filter(
      ([, value]) => value !== undefined && value !== null && value !== "",
    ),
  );

export const emitAnalyticsEvent = (event: string, payload: AnalyticsPayload): void => {
  if (typeof window === "undefined") return;
  const sanitized = sanitizePayload(payload);
  const target = window as {
    gtag?: (command: string, eventName: string, params?: AnalyticsPayload) => void;
    posthog?: { capture?: (eventName: string, params?: AnalyticsPayload) => void };
    amplitude?: {
      getInstance?: () => {
        logEvent?: (eventName: string, params?: AnalyticsPayload) => void;
      };
    };
  };

  target.gtag?.("event", event, sanitized);
  target.posthog?.capture?.(event, sanitized);
  target.amplitude?.getInstance?.()?.logEvent?.(event, sanitized);

  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console -- surfaced only in development for observability
    console.info(`[analytics] ${event}`, sanitized);
  }
};

const toAnalyticsProduct = (
  input: AnalyticsProductInput | CartItemWithProduct | ProductSummaryDTO,
): AnalyticsProductInput => {
  if (isCartItemWithProduct(input)) {
    return buildCartAnalyticsProduct(input);
  }

  if (isProductLike(input)) {
    return buildProductAnalyticsProduct(input);
  }

  return input as AnalyticsProductInput;
};

const toGaItem = (product: AnalyticsProductInput) => ({
  item_id: product.sku ?? product.id,
  item_name: product.title,
  item_variant: product.variantId ?? product.slug,
  item_category: product.categories?.[0]?.name,
  price: Number.parseFloat(parseAmount(product.price).toFixed(2)),
  quantity: product.quantity ?? 1,
  currency: product.price.currency ?? product.currency ?? "TRY",
});

const buildItems = (
  products?: (AnalyticsProductInput | CartItemWithProduct | ProductSummaryDTO)[],
) => products?.map((product) => toGaItem(toAnalyticsProduct(product)));

const resolveCurrency = (
  products?: (AnalyticsProductInput | CartItemWithProduct | ProductSummaryDTO)[],
  fallback?: string,
): string | undefined => {
  if (!products?.length) return fallback;
  const [first] = products;
  if (!first) return fallback;
  if ("price" in first) {
    const asProduct = toAnalyticsProduct(first);
    return asProduct.price.currency ?? asProduct.currency ?? fallback;
  }
  return fallback;
};

const buildPageLocation = (url: string): string => {
  if (url.startsWith("http")) return url;
  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/u, "");
  const path = url.startsWith("/") ? url : `/${url}`;
  return `${base}${path}`;
};

export const trackPageView = (url: string, title?: string): void => {
  emitAnalyticsEvent("page_view", {
    page_location: buildPageLocation(url),
    page_path: url,
    page_title: title,
  });
  addSentryBreadcrumb("page_view", { url, title }, "analytics");
};

export const trackProductView = (product: AnalyticsProductInput | ProductSummaryDTO): void => {
  const item = toGaItem(toAnalyticsProduct(product));
  emitAnalyticsEvent("view_item", {
    currency: item.currency,
    value: item.price,
    items: [item],
  });
  addSentryBreadcrumb("view_item", { productId: item.item_id }, "analytics");
};

export const trackAddToCart = (
  product: AnalyticsProductInput | CartItemWithProduct | ProductSummaryDTO,
  quantity = 1,
): void => {
  const item = toGaItem({ ...toAnalyticsProduct(product), quantity });
  emitAnalyticsEvent("add_to_cart", {
    currency: item.currency,
    value: item.price * item.quantity,
    items: [item],
  });
  addSentryBreadcrumb("add_to_cart", { productId: item.item_id, quantity: item.quantity });
};

export const trackRemoveFromCart = (
  product: AnalyticsProductInput | CartItemWithProduct,
  quantity = 1,
): void => {
  const item = toGaItem({ ...toAnalyticsProduct(product), quantity });
  emitAnalyticsEvent("remove_from_cart", {
    currency: item.currency,
    value: item.price * item.quantity,
    items: [item],
  });
  addSentryBreadcrumb("remove_from_cart", { productId: item.item_id, quantity: item.quantity });
};

export const trackSearch = (query: string, resultsCount: number): void => {
  emitAnalyticsEvent("view_search_results", {
    search_term: query,
    results_count: resultsCount,
  });
  addSentryBreadcrumb("view_search_results", { query, resultsCount }, "analytics");
};

export const trackCheckoutStarted = (
  cartValue: number,
  products?: (AnalyticsProductInput | CartItemWithProduct | ProductSummaryDTO)[],
): void => {
  const items = buildItems(products);
  emitAnalyticsEvent("begin_checkout", {
    currency: resolveCurrency(products),
    value: Number.parseFloat(cartValue.toFixed(2)),
    items,
  });
  addSentryBreadcrumb("begin_checkout", { cartValue, itemCount: items?.length });
};

export const trackCheckoutStep = (
  step: string,
  data?: {
    cartValue?: number;
    currency?: string;
    items?: (AnalyticsProductInput | CartItemWithProduct | ProductSummaryDTO)[];
    shippingMethod?: string;
    paymentMethod?: string;
  },
): void => {
  const items = buildItems(data?.items);
  const currency = data?.currency ?? resolveCurrency(data?.items);
  const value =
    typeof data?.cartValue === "number" ? Number.parseFloat(data.cartValue.toFixed(2)) : undefined;
  const eventName =
    step === "shipping"
      ? "add_shipping_info"
      : step === "payment"
        ? "add_payment_info"
        : "checkout_progress";

  emitAnalyticsEvent(eventName, {
    checkout_step: step,
    shipping_tier: data?.shippingMethod,
    payment_type: data?.paymentMethod,
    value,
    currency,
    items,
  });
  addSentryBreadcrumb("checkout_step", { step, value, currency });
};

export const trackPurchase = (
  order: Pick<OrderDetailDTO, "id" | "reference" | "items" | "totalAmount">,
): void => {
  const items = order.items.map((item: OrderItemDTO) =>
    toGaItem({
      id: item.productId,
      title: item.titleSnapshot,
      price: item.unitPrice,
      currency: item.currency,
      variantId: item.productVariantId,
      quantity: item.quantity,
    }),
  );

  const totalValue = parseAmount(order.totalAmount);
  emitAnalyticsEvent("purchase", {
    transaction_id: order.reference ?? order.id,
    value: Number.parseFloat(totalValue.toFixed(2)),
    currency: order.totalAmount.currency,
    items,
  });
  addSentryBreadcrumb("purchase", {
    orderId: order.id,
    reference: order.reference,
    value: totalValue,
    itemCount: items.length,
  });
};
