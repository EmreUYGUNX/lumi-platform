"use client";

import { useMemo } from "react";

import { ShoppingBag, Trash2 } from "lucide-react";

import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  deriveProductAvailability,
  getPreferredVariant,
  resolveProductMedia,
} from "@/features/products/utils/product-helpers";
import type { WishlistItem as WishlistEntry } from "@/features/wishlist/types/wishlist.types";
import { buildBlurPlaceholder, buildSizesAttribute } from "@/lib/cloudinary";
import { formatMoney } from "@/lib/formatters/price";
import { cloudinaryImageLoader } from "@/lib/image-loader";
import { cn } from "@/lib/utils";

const blur = buildBlurPlaceholder("#0a0a0a");
const sizes = buildSizesAttribute("gallery");

interface WishlistItemProps {
  item: WishlistEntry;
  onAddToCart?: (item: WishlistEntry) => void;
  onRemove?: (item: WishlistEntry) => void;
  disabled?: boolean;
}

export function WishlistItem({
  item,
  onAddToCart,
  onRemove,
  disabled = false,
}: WishlistItemProps): JSX.Element {
  const { product } = item;
  const media = useMemo(() => resolveProductMedia(product), [product]);
  const availability = useMemo(() => deriveProductAvailability(product), [product]);
  const preferredVariant = useMemo(() => getPreferredVariant(product), [product]);
  const price = formatMoney(product.price);
  const compareAt = product.compareAtPrice ? formatMoney(product.compareAtPrice) : undefined;

  const stockLabel =
    availability === "out_of_stock"
      ? "OUT OF STOCK"
      : availability === "low_stock"
        ? "LOW STOCK"
        : "IN STOCK";
  const stockTone =
    availability === "out_of_stock"
      ? "text-lumi-error"
      : availability === "low_stock"
        ? "text-lumi-warning"
        : "text-lumi-text-secondary";

  const handleAdd = () => {
    if (disabled || !onAddToCart) return;
    onAddToCart(item);
  };

  const handleRemove = () => {
    if (disabled || !onRemove) return;
    onRemove(item);
  };

  const href = { pathname: "/products/[slug]", query: { slug: product.slug } } as const;

  return (
    <div className="glass-panel border-lumi-border/70 group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-white/80 shadow-md transition duration-500 hover:-translate-y-1 hover:shadow-lg">
      <Link href={href} aria-label={product.title} className="relative block">
        <div className="bg-lumi-bg relative aspect-[3/4] overflow-hidden">
          <Image
            loader={cloudinaryImageLoader}
            src={media.src}
            alt={media.alt}
            fill
            sizes={sizes}
            placeholder="blur"
            blurDataURL={blur}
            className="object-cover mix-blend-multiply transition duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/0 to-black/40 opacity-0 transition duration-500 group-hover:opacity-100" />
          <div className="absolute left-4 top-4 flex items-center gap-2">
            <span className="text-lumi-text bg-white/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] shadow-sm">
              Wishlist
            </span>
            <span
              className={cn(
                "rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em]",
                stockTone,
                "bg-lumi-bg/80 backdrop-blur",
              )}
            >
              {stockLabel}
            </span>
          </div>
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="space-y-1">
          <Link
            href={href}
            className="text-lumi-text hover:text-lumi-primary line-clamp-1 text-[11px] font-semibold uppercase tracking-[0.28em]"
          >
            {product.title}
          </Link>
          <p className="text-lumi-text-secondary text-[10px] uppercase tracking-[0.2em]">
            {preferredVariant?.title ?? "Primary selection"}
          </p>
          <div className="text-lumi-text-secondary flex items-center gap-2 text-[11px] uppercase tracking-[0.2em]">
            <span className="text-lumi-text">{price}</span>
            {compareAt && <span className="text-lumi-text/60 line-through">{compareAt}</span>}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            className="flex-1 uppercase tracking-[0.22em]"
            onClick={handleAdd}
            disabled={disabled || availability === "out_of_stock" || !preferredVariant}
          >
            <ShoppingBag className="mr-2 h-4 w-4" />
            {availability === "out_of_stock" ? "Unavailable" : "Add to cart"}
          </Button>
          <Button
            variant="outline"
            className="border-lumi-border text-lumi-text-secondary hover:text-lumi-error flex-1 uppercase tracking-[0.2em]"
            onClick={handleRemove}
            disabled={disabled}
            aria-label="Remove item"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Remove
          </Button>
        </div>
      </div>
    </div>
  );
}
