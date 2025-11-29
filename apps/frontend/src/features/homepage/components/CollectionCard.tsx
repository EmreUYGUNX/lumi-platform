"use client";

import type { UrlObject } from "node:url";

import Image from "next/image";
import Link, { type LinkProps } from "next/link";

import { buildBlurPlaceholder, buildCloudinaryUrl, buildSizesAttribute } from "@/lib/cloudinary";
import { cloudinaryImageLoader } from "@/lib/image-loader";
import { cn } from "@/lib/utils";

type LinkHref = LinkProps<string>["href"];

export interface CollectionCardProps {
  title: string;
  href: LinkHref | UrlObject;
  imageId: string;
  count?: number;
  className?: string;
}

const blurPlaceholder = buildBlurPlaceholder("#0a0a0a");
const imageSizes = buildSizesAttribute(undefined, "(max-width: 768px) 100vw, 33vw");

export function CollectionCard({
  title,
  href,
  imageId,
  count,
  className,
}: CollectionCardProps): JSX.Element {
  const imageSrc = buildCloudinaryUrl({
    publicId: imageId,
    transformations: ["c_fill,g_auto,f_auto,q_auto:eco,w_960,h_1280"],
  });

  return (
    <Link
      href={href}
      className={cn(
        "group relative flex cursor-pointer flex-col gap-3 overflow-hidden rounded-2xl",
        className,
      )}
      aria-label={title}
    >
      <div className="bg-lumi-background-secondary relative aspect-[3/4] overflow-hidden rounded-2xl border border-white/5 shadow-[0_25px_60px_rgba(0,0,0,0.08)]">
        <Image
          loader={cloudinaryImageLoader}
          src={imageSrc}
          alt={title}
          fill
          sizes={imageSizes}
          placeholder="blur"
          blurDataURL={blurPlaceholder}
          className="ease-emphasis object-cover mix-blend-multiply transition duration-700 group-hover:scale-105"
          priority={false}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent opacity-80 transition duration-500 group-hover:opacity-100" />
      </div>
      <div className="space-y-1">
        <p className="border-lumi-text w-fit border-b pb-1 text-[11px] font-bold uppercase tracking-[0.3em]">
          {title}
        </p>
        {typeof count === "number" && (
          <span className="text-lumi-text-secondary text-[10px] uppercase tracking-[0.22em]">
            {count} pieces
          </span>
        )}
      </div>
    </Link>
  );
}
