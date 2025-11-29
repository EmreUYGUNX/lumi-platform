import { AlertCircle, RotateCcw } from "lucide-react";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { WishlistItem } from "@/features/wishlist/types/wishlist.types";

import { WishlistItem as WishlistCard } from "./WishlistItem";

const LOADING_PLACEHOLDERS = 8;

interface WishlistGridProps {
  items: WishlistItem[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  onAddToCart?: (item: WishlistItem) => void;
  onRemove?: (item: WishlistItem) => void;
  disabled?: boolean;
}

export function WishlistGrid({
  items,
  isLoading,
  isError,
  onRetry,
  onAddToCart,
  onRemove,
  disabled = false,
}: WishlistGridProps): JSX.Element {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: LOADING_PLACEHOLDERS }).map((_, index) => (
          <div key={`wishlist-skeleton-${index}`} className="space-y-3">
            <Skeleton className="aspect-[3/4] w-full rounded-2xl" />
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-8 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="border-lumi-border/70 bg-lumi-bg-secondary/80 mx-auto flex max-w-2xl flex-col items-center gap-4 rounded-2xl border px-8 py-10 text-center">
        <AlertCircle className="text-lumi-warning h-6 w-6" aria-hidden />
        <p className="text-lumi-text text-sm uppercase tracking-[0.22em]">
          Wishlist yüklenemedi. Yeniden dene.
        </p>
        <Button
          variant="outline"
          className="uppercase tracking-[0.2em]"
          onClick={() => onRetry?.()}
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="border-lumi-border/70 bg-lumi-bg-secondary/70 mx-auto flex max-w-2xl flex-col items-center gap-4 rounded-2xl border px-8 py-10 text-center">
        <p className="text-lumi-text text-sm uppercase tracking-[0.22em]">
          Wishlist&apos;in boş görünüyor.
        </p>
        <p className="text-lumi-text-secondary text-xs uppercase tracking-[0.18em]">
          Beğendiğin ürünleri kaydet, stok durumlarını takip et.
        </p>
        <Button asChild className="uppercase tracking-[0.2em]">
          <Link href="/products">Koleksiyonu keşfet</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 xl:grid-cols-4">
      {items.map((entry) => (
        <WishlistCard
          key={entry.id}
          item={entry}
          onAddToCart={onAddToCart}
          onRemove={onRemove}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
