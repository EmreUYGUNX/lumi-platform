"use client";

import { AlertCircle, RotateCcw } from "lucide-react";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useJustDroppedProducts } from "@/features/homepage/hooks/useJustDroppedProducts";
import type { ProductSummary } from "@/features/products/types/product.types";

import { ProductCard } from "./ProductCard";

const LOADING_PLACEHOLDERS = 24;

export function JustDropped(): JSX.Element {
  const { data, isLoading, isError, refetch, isFetching } = useJustDroppedProducts();
  const products: ProductSummary[] = data?.items ?? [];

  return (
    <section className="bg-white py-20 text-black">
      <div className="container space-y-10">
        <div className="space-y-2 text-center">
          <p className="text-lumi-text-secondary text-[11px] uppercase tracking-[0.3em]">
            Just Dropped
          </p>
          <h2 className="text-2xl font-bold uppercase tracking-[0.24em]">FRESH FROM THE ATELIER</h2>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {Array.from({ length: LOADING_PLACEHOLDERS }).map((_, index) => (
              <div key={`skeleton-${index}`} className="space-y-3">
                <Skeleton className="aspect-square w-full rounded-xl" />
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="border-lumi-border/70 bg-lumi-background-secondary/60 mx-auto flex max-w-xl flex-col items-center gap-4 rounded-xl border px-6 py-8 text-center">
            <AlertCircle className="text-lumi-warning h-6 w-6" aria-hidden />
            <p className="text-lumi-text text-sm uppercase tracking-[0.2em]">
              Ürünleri çekerken bir sorun oluştu
            </p>
            <Button
              variant="outline"
              className="uppercase tracking-[0.2em]"
              onClick={() => {
                refetch();
              }}
              disabled={isFetching}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Tekrar dene
            </Button>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center">
            <p className="text-lumi-text-secondary text-sm uppercase tracking-[0.22em]">
              Yeni ürünler yolda. Bu arada kataloğa göz atın.
            </p>
            <Button asChild className="mt-4 uppercase tracking-[0.2em]">
              <Link href="/products">Browse products</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>

            <div className="flex justify-center">
              <Link
                href="/products"
                className="hover:text-lumi-primary border-b border-black pb-1 text-[11px] font-bold uppercase tracking-[0.32em] transition"
              >
                Shop All
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
