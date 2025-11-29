"use client";

import { Heart, Lock } from "lucide-react";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useAddToCart } from "@/features/cart/hooks/useAddToCart";
import { getPreferredVariant } from "@/features/products/utils/product-helpers";
import { useWishlist } from "@/features/wishlist/hooks/useWishlist";
import { useRemoveFromWishlist } from "@/features/wishlist/hooks/useRemoveFromWishlist";
import type { WishlistItem } from "@/features/wishlist/types/wishlist.types";
import { uiStore } from "@/store";
import { sessionStore } from "@/store/session";

import { WishlistGrid } from "./WishlistGrid";

export function WishlistPage(): JSX.Element {
  const isAuthenticated = sessionStore((state) => state.isAuthenticated);
  const wishlistQuery = useWishlist({ enabled: isAuthenticated });
  const removeItem = useRemoveFromWishlist();
  const addToCart = useAddToCart();

  const items: WishlistItem[] = wishlistQuery.data?.items ?? [];
  const isLoading = isAuthenticated ? wishlistQuery.isLoading || wishlistQuery.isPending : false;
  const isMutating = removeItem.isPending || addToCart.isPending;

  const handleAddToCart = (entry: WishlistItem) => {
    const variant =
      entry.preferredVariantId &&
      entry.product.variants.find((candidate) => candidate.id === entry.preferredVariantId);
    const preferred = variant ?? getPreferredVariant(entry.product);

    if (!preferred) {
      uiStore.getState().enqueueToast({
        variant: "warning",
        title: "Varyant bulunamadı",
        description: "Bu ürün için seçilebilir bir varyant bulunamadı.",
      });
      return;
    }

    addToCart.mutate({ productVariantId: preferred.id, quantity: 1 });
  };

  const handleRemove = (entry: WishlistItem) => {
    removeItem.mutate({ itemId: entry.id });
  };

  const authCallout = (
    <div className="border-lumi-border/70 bg-lumi-bg-secondary/80 relative overflow-hidden rounded-3xl border px-6 py-10 shadow-md">
      <div className="from-lumi-primary/15 via-lumi-secondary/10 to-lumi-accent/10 absolute -left-16 top-0 h-56 w-56 rounded-full bg-gradient-to-br blur-3xl" />
      <div className="relative flex flex-col items-start gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-lumi-bg text-lumi-primary/90 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em]">
            Secure your picks
          </div>
          <Lock className="text-lumi-text-secondary h-4 w-4" aria-hidden />
        </div>
        <h2 className="text-lumi-text text-2xl font-semibold uppercase tracking-[0.3em]">
          Giriş yap, favorilerini sakla.
        </h2>
        <p className="text-lumi-text-secondary text-sm uppercase tracking-[0.2em]">
          Favorilere eklediğin ürünleri cihazlar arasında senkronize etmek için oturum açmalısın.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild className="uppercase tracking-[0.22em]">
            <Link href="/login">Giriş yap</Link>
          </Button>
          <Button asChild variant="outline" className="uppercase tracking-[0.22em]">
            <Link href="/register">Hesap oluştur</Link>
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-lumi-bg text-lumi-text">
      <section className="border-lumi-border/70 from-lumi-bg to-lumi-bg-secondary/60 relative overflow-hidden border-b bg-gradient-to-br">
        <div className="bg-gradient-lumi absolute left-4 top-6 h-32 w-32 rounded-full opacity-20 blur-3xl" />
        <div className="bg-lumi-secondary/20 absolute -top-10 right-8 h-40 w-40 rounded-full blur-3xl" />
        <div className="container relative mx-auto max-w-6xl px-4 py-14">
          <div className="flex flex-col items-start gap-3">
            <div className="text-lumi-text-secondary inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.28em]">
              <Heart className="h-4 w-4" aria-hidden />
              Curated wishlist
            </div>
            <h1 className="text-3xl font-semibold uppercase tracking-[0.32em] md:text-4xl">
              Favori seçimlerin.
            </h1>
            <p className="text-lumi-text-secondary max-w-2xl text-sm uppercase tracking-[0.2em]">
              Beğendiğin parçaları sakla, stok durumlarını takip et ve tek dokunuşla sepete ekle.
            </p>
          </div>
        </div>
      </section>

      <div className="container mx-auto max-w-6xl px-4 py-12">
        {isAuthenticated ? (
          <WishlistGrid
            items={items}
            isLoading={isLoading}
            isError={wishlistQuery.isError}
            onRetry={() => wishlistQuery.refetch()}
            onAddToCart={handleAddToCart}
            onRemove={handleRemove}
            disabled={isMutating}
          />
        ) : (
          authCallout
        )}
      </div>
    </div>
  );
}
