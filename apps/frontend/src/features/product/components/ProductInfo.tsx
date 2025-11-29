import { Link2, MessageCircle, Share2 } from "lucide-react";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/formatters/price";
import { cn } from "@/lib/utils";
import type { ProductReviewStats } from "@/features/product/types/product-detail.types";
import type { VariantAvailability } from "@/features/product/hooks/useVariantSelection";
import type { ProductSummary } from "@/features/products/types/product.types";

import { RatingStars } from "./RatingStars";

interface ProductInfoProps {
  product?: ProductSummary;
  variant?: ProductSummary["variants"][number];
  reviewStats?: ProductReviewStats;
  availability: VariantAvailability;
}

const buildDiscountLabel = (price?: string, compareAt?: string): string | undefined => {
  if (!price || !compareAt) return undefined;

  const normalize = (value: string) => Number.parseFloat(value.replace(",", "."));
  const current = normalize(price);
  const previous = normalize(compareAt);

  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= current) {
    return undefined;
  }

  const discount = Math.round(((previous - current) / previous) * 100);
  return `-${discount}%`;
};

const AvailabilityBadge = ({ availability }: { availability: VariantAvailability }) => {
  const label =
    availability === "out_of_stock"
      ? "Out of Stock"
      : availability === "low_stock"
        ? "Low Stock"
        : "In Stock";

  const tone =
    availability === "out_of_stock"
      ? "bg-lumi-error/10 text-lumi-error border-lumi-error/30"
      : availability === "low_stock"
        ? "bg-lumi-warning/10 text-lumi-warning border-lumi-warning/30"
        : "bg-lumi-success/10 text-lumi-success border-lumi-success/30";

  return (
    <span
      className={cn(
        "rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]",
        tone,
      )}
    >
      {label}
    </span>
  );
};

const deriveBrand = (product?: ProductSummary): string | undefined => {
  const attrs = product?.attributes as Record<string, unknown> | undefined;
  if (attrs) {
    const { brand } = attrs;
    if (typeof brand === "string") return brand;
    if (Array.isArray(brand) && typeof brand[0] === "string") return brand[0];
  }
  return undefined;
};

export function ProductInfo({
  product,
  variant,
  reviewStats,
  availability,
}: ProductInfoProps): JSX.Element {
  const brand = deriveBrand(product);
  const price = formatMoney(variant?.price ?? product?.price);
  const compareAt = formatMoney(variant?.compareAtPrice ?? product?.compareAtPrice);
  const discount = buildDiscountLabel(
    variant?.price?.amount ?? product?.price?.amount,
    (variant?.compareAtPrice ?? product?.compareAtPrice)?.amount,
  );
  const ratingValue = reviewStats?.averageRating ?? 0;

  return (
    <div className="border-lumi-border/70 space-y-4 rounded-2xl border bg-white/60 p-6 shadow-lg backdrop-blur">
      <div className="space-y-2">
        <p className="text-lumi-text-secondary text-[11px] font-semibold uppercase tracking-[0.32em]">
          {brand ?? "Lumi Studio"}
        </p>
        <h1 className="text-lumi-text text-3xl font-light uppercase tracking-[0.22em] sm:text-4xl">
          {product?.title}
        </h1>
        {product?.sku && (
          <p className="text-lumi-text-secondary text-[10px] uppercase tracking-[0.18em]">
            SKU • {product.sku}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <RatingStars value={ratingValue} />
          <span className="text-lumi-text-secondary text-[11px] uppercase tracking-[0.18em]">
            {ratingValue.toFixed(1)} / 5
          </span>
        </div>
        <Link
          href="#reviews"
          className="text-lumi-primary text-[11px] font-semibold uppercase tracking-[0.18em] hover:underline"
        >
          {reviewStats?.totalReviews ?? 0} Reviews
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <p className="text-lumi-text text-2xl font-semibold tracking-tight">{price}</p>
        {compareAt && (
          <p className="text-lumi-text-secondary text-base line-through">{compareAt}</p>
        )}
        {discount && (
          <Badge
            variant="secondary"
            className="bg-lumi-secondary/10 text-lumi-secondary rounded-full text-[10px] font-semibold uppercase tracking-[0.2em]"
          >
            {discount}
          </Badge>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <AvailabilityBadge availability={availability} />
        {brand && (
          <Link
            href={{ pathname: "/products", query: { brand } }}
            className="text-lumi-text-secondary text-[10px] uppercase tracking-[0.18em] underline underline-offset-4"
          >
            View more from {brand}
          </Link>
        )}
      </div>

      {product?.summary && (
        <p className="text-lumi-text-secondary text-sm leading-6">{product.summary}</p>
      )}

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em]"
          onClick={async () => {
            const shareUrl = typeof window === "undefined" ? undefined : window.location.href;
            try {
              await navigator.share?.({
                title: product?.title ?? "Lumi Product",
                text: product?.summary ?? undefined,
                url: shareUrl,
              });
            } catch {
              if (shareUrl) {
                await navigator.clipboard?.writeText(shareUrl);
              }
            }
          }}
        >
          <Share2 className="h-4 w-4" />
          Share
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em]"
          onClick={() => {
            const shareUrl = typeof window === "undefined" ? undefined : window.location.href;
            if (shareUrl) {
              navigator.clipboard?.writeText(shareUrl);
            }
          }}
        >
          <Link2 className="h-4 w-4" />
          Copy Link
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em]"
          onClick={() => {
            const shareUrl = typeof window === "undefined" ? undefined : window.location.href;
            if (!shareUrl) return;
            const encoded = encodeURIComponent(`${product?.title ?? "Check this"} - ${shareUrl}`);
            window.open(`https://wa.me/?text=${encoded}`, "_blank", "noopener,noreferrer");
          }}
        >
          <MessageCircle className="h-4 w-4" />
          WhatsApp
        </Button>
      </div>
    </div>
  );
}
