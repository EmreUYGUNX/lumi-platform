"use client";

/* eslint-disable import/order */

import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type { ProductSummary } from "@/features/products/types/product.types";
import { buildBlurPlaceholder, buildCloudinaryUrl, buildSizesAttribute } from "@/lib/cloudinary";
import { formatMoney } from "@/lib/formatters/price";
import { cloudinaryImageLoader } from "@/lib/image-loader";
import { cn } from "@/lib/utils";

const blur = buildBlurPlaceholder("#f5f5f5");
const sizes = buildSizesAttribute(
  undefined,
  "(max-width: 768px) 50vw, (max-width: 1280px) 25vw, 18vw",
);

interface ProductCardProps {
  product: ProductSummary;
  priority?: boolean;
}

const resolveMediaUrl = (product: ProductSummary): { src: string; alt: string } => {
  const primary = product.media.find((item) => item.isPrimary)?.media ?? product.media[0]?.media;
  if (primary?.url) {
    return { src: primary.url, alt: primary.alt ?? product.title };
  }

  return {
    src: buildCloudinaryUrl({
      publicId: "sample",
      transformations: ["c_fill,g_auto,f_auto,q_auto:eco,w_720,h_720"],
    }),
    alt: product.title,
  };
};

export function ProductCard({ product, priority = false }: ProductCardProps): JSX.Element {
  const { src, alt } = resolveMediaUrl(product);
  const price = formatMoney(product.price);
  const href = `/products/${product.slug}` as Route;
  const router = useRouter();
  const prefetchProduct = () => router.prefetch(href);

  return (
    <Link
      href={href}
      className="group flex flex-col gap-3"
      aria-label={`View ${product.title}`}
      prefetch
      onMouseEnter={prefetchProduct}
      onFocus={prefetchProduct}
    >
      <div className="border-lumi-border/60 relative aspect-square min-h-[200px] w-full overflow-hidden rounded-xl border bg-neutral-100">
        <Image
          loader={cloudinaryImageLoader}
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          placeholder="blur"
          blurDataURL={blur}
          className="ease-emphasis object-cover transition duration-500 group-hover:scale-105"
          priority={priority}
          loading={priority ? "eager" : "lazy"}
        />
      </div>
      <div className="space-y-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.28em]">{product.title}</p>
        <p className={cn("text-lumi-text-secondary text-xs uppercase tracking-[0.18em]")}>
          {price}
        </p>
      </div>
    </Link>
  );
}
