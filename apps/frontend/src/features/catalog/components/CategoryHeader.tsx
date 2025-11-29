import type { Route } from "next";

import Image from "next/image";
import Link from "next/link";

import { buildBlurPlaceholder, buildCloudinaryUrl, buildSizesAttribute } from "@/lib/cloudinary";
import { cloudinaryImageLoader } from "@/lib/image-loader";

interface CategoryHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: { label: string; href?: string }[];
  backgroundId?: string;
  backgroundUrl?: string;
}

const blur = buildBlurPlaceholder("#0a0a0a");
const sizes = buildSizesAttribute("detail");

export function CategoryHeader({
  title,
  subtitle,
  breadcrumbs = [{ label: "Home", href: "/" }],
  backgroundId,
  backgroundUrl,
}: CategoryHeaderProps): JSX.Element {
  const resolvedBackground =
    backgroundUrl ??
    buildCloudinaryUrl({
      publicId: backgroundId ?? "sample",
      transformations: ["c_fill,g_auto,f_auto,q_auto:eco,w_1920,h_1080"],
    });

  return (
    <section className="relative h-[40vh] overflow-hidden bg-black text-white">
      <Image
        loader={cloudinaryImageLoader}
        src={resolvedBackground}
        alt={title}
        fill
        sizes={sizes}
        placeholder="blur"
        blurDataURL={blur}
        className="object-cover opacity-60"
        priority
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-black/50" />
      <div className="relative mx-auto flex h-full max-w-5xl flex-col items-center justify-center text-center">
        <p className="text-[11px] uppercase tracking-[0.32em] text-gray-200">
          {subtitle ?? "Curated Catalog"}
        </p>
        <h1 className="text-4xl font-light uppercase tracking-[0.32em] md:text-5xl">{title}</h1>
        <div className="mt-4 flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-gray-200">
          {breadcrumbs.map((crumb, index) => (
            <span key={`${crumb.label}-${index}`} className="flex items-center gap-2">
              {crumb.href ? (
                <Link href={(crumb.href ?? "/") as Route} className="transition hover:text-white">
                  {crumb.label}
                </Link>
              ) : (
                <span>{crumb.label}</span>
              )}
              {index < breadcrumbs.length - 1 && <span className="opacity-70">/</span>}
            </span>
          ))}
          <span className="font-semibold text-white">{title}</span>
        </div>
      </div>
    </section>
  );
}
