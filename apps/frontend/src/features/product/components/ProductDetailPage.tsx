"use client";

import { Suspense, useMemo } from "react";

import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProductDetail } from "@/features/product/hooks/useProductDetail";
import { useProductReviews } from "@/features/product/hooks/useProductReviews";
import { useVariantSelection } from "@/features/product/hooks/useVariantSelection";
import type { ProductDetail } from "@/features/product/types/product-detail.types";

import { AddToCartButton } from "./AddToCartButton";
import { ProductGallery } from "./ProductGallery";
import { ProductInfo } from "./ProductInfo";
import { ProductTabs } from "./ProductTabs";
import { RelatedProducts } from "./RelatedProducts";
import { VariantSelector } from "./VariantSelector";

interface ProductDetailPageProps {
  slug: string;
  initialData?: ProductDetail;
}

const ProductDetailSkeleton = () => (
  <div className="space-y-8">
    <div className="bg-lumi-bg-secondary h-5 w-48 rounded-full" />
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <Skeleton className="aspect-[4/5] w-full rounded-2xl" />
      <div className="space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    </div>
    <Skeleton className="h-64 w-full" />
  </div>
);

export function ProductDetailPage({ slug, initialData }: ProductDetailPageProps): JSX.Element {
  const detailQuery = useProductDetail(slug, { initialData });
  const product = detailQuery.data?.product;
  const reviewStats = detailQuery.data?.reviews;

  const variantState = useVariantSelection(product);

  const reviewsState = useProductReviews({
    productId: product?.id,
    productSlug: slug,
    stats: reviewStats,
  });

  const pageTitle = useMemo(() => product?.title ?? "Product detail", [product?.title]);

  if (detailQuery.isLoading) {
    return (
      <div className="container mx-auto max-w-6xl px-4 py-10">
        <ProductDetailSkeleton />
      </div>
    );
  }

  if (detailQuery.isError || !product) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-10">
        <div className="border-lumi-error/30 bg-lumi-error/10 text-lumi-error rounded-2xl border p-6">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            <p className="text-lg font-semibold">Ürün bulunamadı</p>
          </div>
          <p className="mt-2 text-sm">
            İstediğiniz ürün kaldırılmış veya geçici olarak kullanılamıyor. Lütfen ürün listesine
            geri dönün.
          </p>
          <Button asChild className="mt-4 rounded-full uppercase tracking-[0.2em]">
            <a href="/products">Catalog</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-lumi-bg">
      <div className="container mx-auto max-w-6xl px-4 py-10">
        <div className="text-lumi-text-secondary mb-4 text-[10px] uppercase tracking-[0.18em]">
          <a href="/" className="hover:text-lumi-text">
            Home
          </a>{" "}
          /{" "}
          <a href="/products" className="hover:text-lumi-text">
            Products
          </a>{" "}
          / <span className="text-lumi-text">{pageTitle}</span>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <ProductGallery product={product} activeVariantId={variantState.selectedVariant?.id} />

          <div className="space-y-4">
            <ProductInfo
              product={product}
              variant={variantState.selectedVariant}
              availability={variantState.availability}
              reviewStats={reviewStats}
            />
            <VariantSelector
              product={product}
              selection={variantState.selection}
              attributeOptions={variantState.attributeOptions}
              selectedVariant={variantState.selectedVariant}
              availability={variantState.availability}
              onSelectAttribute={variantState.selectAttribute}
              onReset={variantState.resetSelection}
            />
            <AddToCartButton
              product={product}
              variant={variantState.selectedVariant}
              availability={variantState.availability}
            />
          </div>
        </div>

        <div className="mt-10 space-y-10">
          <ProductTabs
            product={product}
            reviewStats={reviewStats}
            reviews={reviewsState.data ?? []}
            onSubmitReview={async (input) => {
              await reviewsState.submitReview.mutateAsync(input);
            }}
            submittingReview={reviewsState.submitReview.isPending}
            onVoteReview={(id, vote) => reviewsState.voteReview.mutate({ reviewId: id, vote })}
            isVoting={reviewsState.voteReview.isPending}
          />

          <Suspense fallback={<Skeleton className="h-40 w-full" />}>
            <RelatedProducts product={product} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
