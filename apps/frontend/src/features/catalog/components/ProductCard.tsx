"use client";

/* eslint-disable import/order */

import { useMemo } from "react";

import { Heart, ShoppingBag } from "lucide-react";

import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type { ProductSummary } from "@/features/products/types/product.types";
import { Button } from "@/components/ui/button";
import { useAddToCart } from "@/features/cart/hooks/useAddToCart";
import {
  deriveProductAvailability,
  getPrimaryVariant,
  resolveProductMedia,
} from "@/features/products/utils/product-helpers";
import { useAddToWishlist } from "@/features/wishlist/hooks/useAddToWishlist";
import { buildBlurPlaceholder, buildSizesAttribute } from "@/lib/cloudinary";
import { cloudinaryImageLoader } from "@/lib/image-loader";
import { formatMoney } from "@/lib/formatters/price";
import { cn } from "@/lib/utils";

const blur = buildBlurPlaceholder("#0a0a0a");
const sizes = buildSizesAttribute("gallery");

const parseAmount = (value: string | undefined): number => {
  if (!value) return 0;
  const normalized = value.replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const deriveBadge = (product: ProductSummary): string | undefined => {
  const compareAmount = parseAmount(product.compareAtPrice?.amount);
  const priceAmount = parseAmount(product.price.amount);

  if (compareAmount > priceAmount && priceAmount > 0) {
    const discount = Math.round(((compareAmount - priceAmount) / compareAmount) * 100);
    return `-${discount}%`;
  }

  const createdAt = new Date(product.createdAt);
  const daysSinceCreate = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
  if (Number.isFinite(daysSinceCreate) && daysSinceCreate <= 21) {
    return "NEW";
  }

  return undefined;
};

interface ProductCardProps {
  product: ProductSummary;
  className?: string;
  priority?: boolean;
}

export function ProductCard({
  product,
  className,
  priority = false,
}: ProductCardProps): JSX.Element {
  const { src, alt } = useMemo(() => resolveProductMedia(product), [product]);
  const price = formatMoney(product.price);
  const compareAt = product.compareAtPrice ? formatMoney(product.compareAtPrice) : undefined;
  const badge = deriveBadge(product);
  const availability = deriveProductAvailability(product);
  const router = useRouter();

  const addToCart = useAddToCart();
  const addToWishlist = useAddToWishlist();
  const primaryVariant = useMemo(() => getPrimaryVariant(product), [product]);
  const canQuickAdd = availability !== "out_of_stock" && primaryVariant !== undefined;

  const handleQuickAdd = () => {
    if (!primaryVariant || !canQuickAdd) return;

    addToCart.mutate({
      productVariantId: primaryVariant.id,
      quantity: 1,
      product,
      variant: primaryVariant,
    });
  };

  const href = { pathname: "/products/[slug]", query: { slug: product.slug } } as const;
  const hrefString = `/products/${product.slug}` as Route;

  const prefetchProduct = () => {
    router.prefetch(hrefString);
  };

  return (
    <div
      className={cn(
        "group relative flex flex-col gap-3 transition duration-500 hover:-translate-y-1",
        className,
      )}
    >
      <Link
        href={href}
        aria-label={`View ${product.title}`}
        className="relative block"
        onMouseEnter={prefetchProduct}
        onFocus={prefetchProduct}
      >
        <div className="bg-lumi-text relative aspect-[3/4] overflow-hidden rounded-xl">
          <Image
            loader={cloudinaryImageLoader}
            src={src}
            alt={alt}
            fill
            sizes={sizes}
            placeholder="blur"
            blurDataURL={blur}
            className="object-cover mix-blend-multiply transition duration-700 group-hover:scale-105"
            priority={priority}
            loading={priority ? "eager" : "lazy"}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-black/30 opacity-0 transition duration-500 group-hover:opacity-100" />
          {badge && (
            <span className="text-lumi-text absolute left-2 top-2 rounded-full bg-white/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] shadow-sm">
              {badge}
            </span>
          )}
          <button
            type="button"
            className="text-lumi-text absolute right-2 top-2 min-h-[44px] min-w-[44px] rounded-full bg-white/90 p-2 opacity-0 shadow-sm transition duration-500 hover:bg-white group-hover:opacity-100"
            aria-label="Add to wishlist"
            onClick={(event) => {
              event.preventDefault();
              addToWishlist.mutate({ productId: product.id, product });
            }}
            disabled={addToWishlist.isPending}
            aria-busy={addToWishlist.isPending}
          >
            <Heart className="h-4 w-4 transition duration-300" />
          </button>
          <div className="absolute inset-x-4 bottom-3 flex justify-center">
            <Button
              size="sm"
              className={cn(
                "uppercase tracking-[0.2em] opacity-0 transition duration-500",
                "text-lumi-text bg-white/90 shadow-md hover:bg-white",
                "group-hover:opacity-100",
              )}
              disabled={!canQuickAdd || addToCart.isPending}
              onClick={(event) => {
                event.preventDefault();
                handleQuickAdd();
              }}
            >
              <ShoppingBag className="mr-2 h-4 w-4" />
              {addToCart.isPending
                ? "Adding..."
                : availability === "out_of_stock"
                  ? "Sold Out"
                  : "Quick Add"}
            </Button>
          </div>
        </div>
      </Link>

      <Link
        href={href}
        className="space-y-1"
        onMouseEnter={prefetchProduct}
        onFocus={prefetchProduct}
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.3em]">{product.title}</p>
        <div className="text-lumi-text-secondary flex items-center gap-2 text-[11px] uppercase tracking-[0.18em]">
          <span>{price}</span>
          {compareAt && <span className="text-lumi-text/60 line-through">{compareAt}</span>}
        </div>
        <p className="text-lumi-text-secondary text-[10px] uppercase tracking-[0.18em]">
          {availability === "out_of_stock"
            ? "Out of stock"
            : availability === "low_stock"
              ? "Low stock"
              : "In stock"}
        </p>
      </Link>
    </div>
  );
}
