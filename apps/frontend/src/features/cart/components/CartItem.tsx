"use client";

/* eslint-disable import/order */

import { Minus, Plus, Trash2 } from "lucide-react";
import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { buildBlurPlaceholder, buildCloudinaryUrl } from "@/lib/cloudinary";
import { formatMoney } from "@/lib/formatters/price";
import { cloudinaryImageLoader } from "@/lib/image-loader";
import { cn } from "@/lib/utils";

import type { CartItemWithProduct } from "../types/cart.types";

const fallbackImage = buildCloudinaryUrl({
  publicId: "lumi/products/board-001",
  transformations: ["c_fill,g_auto,f_auto,q_auto:eco,w_480,h_640"],
});
const blur = buildBlurPlaceholder("#0a0a0a");

const parseAmount = (value: string): number => {
  const normalised = value.replace(",", ".");
  const parsed = Number.parseFloat(normalised);
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildLineTotal = (item: CartItemWithProduct) => {
  const amount = parseAmount(item.unitPrice.amount) * item.quantity;
  return formatMoney({ amount: amount.toFixed(2), currency: item.unitPrice.currency });
};

const resolveVariantLabel = (item: CartItemWithProduct): string => {
  const attributes = item.variant.attributes as Record<string, unknown> | undefined;
  if (!attributes) {
    return item.variant.title;
  }
  const entries = Object.entries(attributes)
    .filter(
      ([, value]) =>
        typeof value === "string" ||
        typeof value === "number" ||
        (Array.isArray(value) && value.length > 0),
    )
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return `${key}: ${value[0]}`;
      }
      return `${key}: ${value}`;
    });

  return entries.length > 0 ? entries.join(" / ") : item.variant.title;
};

const resolveItemMedia = (item: CartItemWithProduct): { src: string; alt: string } => {
  // Cart API does not include media payload; fall back to a stable placeholder.
  return { src: fallbackImage, alt: item.product.title };
};

interface CartItemProps {
  item: CartItemWithProduct;
  compact?: boolean;
  disabled?: boolean;
  onIncrement?: () => void;
  onDecrement?: () => void;
  onRemove?: () => void;
  onMoveToWishlist?: () => void;
}

export function CartItem({
  item,
  compact = false,
  disabled = false,
  onIncrement,
  onDecrement,
  onRemove,
  onMoveToWishlist,
}: CartItemProps): JSX.Element {
  const lineTotal = buildLineTotal(item);
  const unitPrice = formatMoney(item.unitPrice);
  const variantLabel = resolveVariantLabel(item);
  const media = resolveItemMedia(item);
  const router = useRouter();
  const productHref = { pathname: "/products/[slug]", query: { slug: item.product.slug } } as const;
  const productHrefString = `/products/${item.product.slug}` as Route;
  const prefetchProduct = () => router.prefetch(productHrefString);
  const lowStock =
    item.availableStock <= 0
      ? "Out of stock"
      : item.availableStock <= 3
        ? `Only ${item.availableStock} left`
        : undefined;

  return (
    <div
      className={cn(
        "glass-panel border-lumi-border/70 relative flex gap-4 rounded-2xl border bg-white/80 p-4 shadow-md",
        compact ? "items-start" : "items-center",
      )}
    >
      <Link
        href={productHref}
        className="bg-lumi-bg relative block h-24 w-20 overflow-hidden rounded-xl"
        aria-label={item.product.title}
        onMouseEnter={prefetchProduct}
        onFocus={prefetchProduct}
      >
        <Image
          loader={cloudinaryImageLoader}
          src={media.src}
          alt={media.alt}
          fill
          sizes="120px"
          placeholder="blur"
          blurDataURL={blur}
          className="object-cover mix-blend-multiply transition duration-500 hover:scale-105"
          priority={false}
          loading="lazy"
        />
      </Link>
      <div className="flex flex-1 flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <Link
              href={productHref}
              className="text-lumi-text hover:text-lumi-primary line-clamp-1 text-sm font-semibold uppercase tracking-[0.22em]"
              onMouseEnter={prefetchProduct}
              onFocus={prefetchProduct}
            >
              {item.product.title}
            </Link>
            <p className="text-lumi-text-secondary text-[11px] uppercase tracking-[0.18em]">
              {variantLabel}
            </p>
            <p className="text-lumi-text/80 text-[11px] uppercase tracking-[0.18em]">{unitPrice}</p>
          </div>
          <div className="flex items-start gap-2">
            {!compact && (
              <button
                type="button"
                className="text-lumi-text-secondary hover:text-lumi-text text-[10px] uppercase tracking-[0.16em] underline decoration-dotted underline-offset-4 transition disabled:cursor-not-allowed disabled:opacity-50"
                onClick={onMoveToWishlist}
                disabled={disabled}
              >
                Move to wishlist
              </button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="text-lumi-text-secondary hover:text-lumi-error"
              onClick={onRemove}
              disabled={disabled}
              aria-label="Remove item"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="border-lumi-border/80 flex items-center rounded-full border bg-white/80 shadow-inner">
            <button
              type="button"
              onClick={onDecrement}
              disabled={disabled || item.quantity <= 1}
              className="hover:text-lumi-primary text-lumi-text px-3 py-2 transition disabled:opacity-40"
              aria-label="Decrease quantity"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="text-lumi-text min-w-[32px] text-center text-[11px] font-semibold uppercase tracking-[0.22em]">
              {item.quantity}
            </span>
            <button
              type="button"
              onClick={onIncrement}
              disabled={disabled || item.quantity >= item.availableStock || item.quantity >= 10}
              className="hover:text-lumi-primary text-lumi-text px-3 py-2 transition disabled:opacity-40"
              aria-label="Increase quantity"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="text-right">
            <p className="text-lumi-text-secondary text-[10px] uppercase tracking-[0.16em]">
              Line total
            </p>
            <p className="text-lumi-text text-sm font-semibold">{lineTotal}</p>
            {lowStock && (
              <p className="text-lumi-warning text-[10px] uppercase tracking-[0.16em]">
                {lowStock}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
