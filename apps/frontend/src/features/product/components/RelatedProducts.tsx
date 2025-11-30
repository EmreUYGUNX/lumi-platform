"use client";

import { useRef } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { ProductCard } from "@/features/catalog/components/ProductCard";
import { useProducts } from "@/features/products/hooks/useProducts";
import type { ProductSummary } from "@/features/products/types/product.types";
import { useSwipeScroll } from "@/hooks/useSwipeScroll";

interface RelatedProductsProps {
  product?: ProductSummary;
}

export function RelatedProducts({ product }: RelatedProductsProps): JSX.Element | null {
  const primaryCategory = product?.categories[0]?.slug;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useSwipeScroll(scrollRef);

  const relatedQuery = useProducts(
    {
      categorySlug: primaryCategory,
      pageSize: 8,
      page: 1,
    },
    { enabled: Boolean(primaryCategory) },
  );

  if (relatedQuery.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-48" />
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={`related-skeleton-${index}`} className="h-64 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const items =
    relatedQuery.data?.items.filter((item) => item.id !== product?.id).slice(0, 6) ?? [];

  if (items.length === 0) {
    return <></>;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lumi-text text-xl font-semibold uppercase tracking-[0.2em]">
        You may also like
      </h3>
      <div
        ref={scrollRef}
        className="flex touch-pan-y snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => (
          <div key={item.id} className="min-w-[240px] snap-start">
            <ProductCard product={item} />
          </div>
        ))}
      </div>
    </div>
  );
}
