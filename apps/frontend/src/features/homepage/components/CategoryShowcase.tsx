"use client";

import type { Route } from "next";

import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

import { categoryTiles } from "../data";

export function CategoryShowcase(): JSX.Element {
  return (
    <section className="container space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <p className="text-lumi-text-secondary text-xs uppercase tracking-[0.3em]">Kategoriler</p>
          <h2 className="text-3xl font-semibold">Cam yüzeyli kategori vitrinleri</h2>
          <p className="text-lumi-text-secondary text-sm">
            Zoom efektleri ve ürün sayısı rozetleriyle kategori geçişleri.
          </p>
        </div>
        <Link
          href={"/products" as Route}
          className="text-lumi-primary text-sm font-semibold underline-offset-4 hover:underline"
        >
          Tüm ürünler
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 md:gap-6 lg:grid-cols-3">
        {categoryTiles.slice(0, 6).map((category) => (
          <Link key={category.id} href={category.href as Route} className="group">
            <Card className="relative isolate overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-lg transition duration-500 hover:-translate-y-1 hover:shadow-xl">
              <div className="relative h-48 w-full overflow-hidden">
                <Image
                  src={category.image}
                  alt={category.name}
                  fill
                  sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                  className="object-cover transition duration-500 group-hover:scale-105"
                  priority={category.id === "outerwear"}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
              </div>
              <div className="absolute inset-0">
                <div className="absolute inset-0 bg-white/5 opacity-0 transition duration-500 group-hover:opacity-100" />
              </div>
              <div className="absolute inset-0 flex flex-col justify-between p-4">
                <div className="flex items-center gap-2">
                  <Badge className="border-white/20 bg-white/10 text-white backdrop-blur">
                    {category.productCount} ürün
                  </Badge>
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-semibold text-white drop-shadow">{category.name}</h3>
                  <p className="text-xs text-white/80">Kategoriye git →</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
