"use client";

import { useEffect, useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import type { Route } from "next";

import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

import { featuredProducts, type FeaturedProduct } from "../data";

const QUERY_KEY = ["homepage", "featured-products"];

const fetchFeaturedProducts = async (): Promise<FeaturedProduct[]> => {
  // Mocked fetch with latency to mirror a real request
  await new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve();
    }, 350);
  });
  return featuredProducts;
};

export function FeaturedProducts(): JSX.Element {
  const { toast } = useToast();
  const { data, isError, isLoading, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchFeaturedProducts,
    staleTime: 5 * 60 * 1000,
  });
  const [active, setActive] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const products = data ?? [];
  const total = products.length;

  useEffect(() => {
    const id =
      !total || isPaused
        ? undefined
        : window.setInterval(() => {
            setActive((current) => (current + 1) % total);
          }, 4800);

    return () => {
      if (id) clearInterval(id);
    };
  }, [total, isPaused]);

  const handleAddToCart = (item: FeaturedProduct) => {
    toast({
      title: "Sepete eklendi",
      description: `${item.name} sepete eklendi. Hızlı ödeme için sepeti aç.`,
    });
  };

  const viewportWidth = useMemo(() => `${(total || 1) * 100}%`, [total]);

  return (
    <section className="container space-y-6">
      <header className="flex flex-col gap-2">
        <div className="text-lumi-text-secondary inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em]">
          <span className="bg-lumi-primary h-1 w-6 rounded-full" />
          Öne çıkanlar
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-3xl font-semibold">Öne çıkan ürünler</h2>
            <p className="text-lumi-text-secondary text-sm">
              Cam efektli kartlar, mikro etkileşimler ve sepet kısayolu.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="text-lumi-text-secondary hover:text-white"
              aria-label="Önceki ürün"
              onClick={() => setActive((index) => (index - 1 + total) % (total || 1))}
            >
              ←
            </button>
            <button
              type="button"
              className="text-lumi-text-secondary hover:text-white"
              aria-label="Sonraki ürün"
              onClick={() => setActive((index) => (index + 1) % (total || 1))}
            >
              →
            </button>
          </div>
        </div>
      </header>

      <div
        className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-2 backdrop-blur"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {isLoading && <FeaturedSkeleton />}
        {isError && (
          <div className="bg-lumi-bg-secondary/60 text-lumi-text-secondary flex flex-col items-center gap-3 rounded-2xl p-8 text-sm">
            <p>Öne çıkan ürünler yüklenemedi.</p>
            <Button variant="outline" onClick={() => refetch()}>
              Tekrar dene
            </Button>
          </div>
        )}

        {!isLoading && !isError && total > 0 && (
          <>
            <div
              className="flex transition-transform duration-500 ease-in-out"
              style={{ width: viewportWidth, transform: `translateX(-${active * (100 / total)}%)` }}
            >
              {products.map((product) => (
                <article key={product.id} className="w-full flex-shrink-0 px-2 md:px-4">
                  <Card className="glass-panel border-lumi-border/70 shadow-glow group relative grid gap-6 overflow-hidden rounded-3xl border bg-white/5 p-2 md:grid-cols-2">
                    <div className="relative isolate h-64 overflow-hidden rounded-2xl bg-black/30">
                      <Image
                        src={product.image}
                        alt={product.name}
                        fill
                        className="object-cover transition duration-700 group-hover:scale-105"
                        sizes="(max-width: 768px) 100vw, 50vw"
                        priority={active === 0}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent" />
                      {product.badge && (
                        <Badge className="absolute left-3 top-3 bg-white/10 text-white backdrop-blur">
                          {product.badge}
                        </Badge>
                      )}
                    </div>

                    <CardContent className="relative space-y-4 p-6">
                      <CardHeader className="space-y-3 p-0">
                        <CardTitle className="text-2xl">{product.name}</CardTitle>
                        <p className="text-lumi-text-secondary text-sm leading-relaxed">
                          {product.description}
                        </p>
                      </CardHeader>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-2xl font-semibold text-white">{product.price}</span>
                        {product.metrics && (
                          <span className="text-lumi-primary text-sm font-medium">
                            {product.metrics}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <Button asChild className="bg-lumi-primary hover:bg-lumi-primary-dark">
                          <Link href={`/products/${product.id}` as Route}>Hızlı incele</Link>
                        </Button>
                        <Button variant="outline" onClick={() => handleAddToCart(product)}>
                          Sepete ekle
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </article>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-center gap-2">
              {products.map((product, index) => (
                <button
                  key={product.id}
                  type="button"
                  aria-label={`${product.name} görüntüle`}
                  className={`h-2.5 rounded-full transition-all ${
                    active === index ? "bg-lumi-primary w-8" : "w-2 bg-white/40"
                  }`}
                  onClick={() => setActive(index)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function FeaturedSkeleton(): JSX.Element {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {[0, 1].map((item) => (
        <Card key={item} className="border-lumi-border/70 grid gap-4 border bg-white/5 p-4">
          <Skeleton className="h-56 w-full rounded-2xl" />
          <div className="space-y-3">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <div className="flex gap-3">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-32" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
