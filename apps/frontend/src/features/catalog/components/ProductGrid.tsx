import { AlertCircle, Loader2, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { CatalogViewMode } from "@/features/catalog/hooks/useProductFilters";
import type { ProductSummary } from "@/features/products/types/product.types";

import { ProductCard } from "./ProductCard";

const LOADING_PLACEHOLDERS = 24;

interface ProductGridProps {
  products: ProductSummary[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  onClearFilters?: () => void;
  viewMode?: CatalogViewMode;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
}

export function ProductGrid({
  products,
  isLoading,
  isError,
  onRetry,
  onClearFilters,
  viewMode = "paged",
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: ProductGridProps): JSX.Element {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
        {Array.from({ length: LOADING_PLACEHOLDERS }).map((_, index) => (
          <div key={`skeleton-${index}`} className="space-y-3">
            <Skeleton className="aspect-[3/4] w-full rounded-xl" />
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="border-lumi-border/70 bg-lumi-bg-secondary/70 mx-auto flex max-w-xl flex-col items-center gap-4 rounded-2xl border px-8 py-10 text-center">
        <AlertCircle className="text-lumi-warning h-6 w-6" aria-hidden />
        <p className="text-lumi-text text-sm uppercase tracking-[0.22em]">
          Ürünler yüklenemedi. Yeniden dene.
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

  if (products.length === 0) {
    return (
      <div className="border-lumi-border/70 bg-lumi-bg-secondary/70 mx-auto flex max-w-xl flex-col items-center gap-3 rounded-2xl border px-8 py-10 text-center">
        <p className="text-lumi-text text-sm uppercase tracking-[0.22em]">
          No products found for these filters.
        </p>
        {onClearFilters && (
          <Button
            variant="outline"
            className="uppercase tracking-[0.2em]"
            onClick={() => onClearFilters()}
          >
            Clear filters
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      {viewMode === "infinite" && hasNextPage && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            className="min-w-[200px] uppercase tracking-[0.22em]"
            onClick={onLoadMore}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading
              </>
            ) : (
              "Load More"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
