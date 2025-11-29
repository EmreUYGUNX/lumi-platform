"use client";

import Image from "next/image";
import type { LinkProps } from "next/link";

import { buildBlurPlaceholder, buildCloudinaryUrl, buildSizesAttribute } from "@/lib/cloudinary";
import { cloudinaryImageLoader } from "@/lib/image-loader";
import { cn } from "@/lib/utils";

import { CtaLink } from "./CtaLink";

type LinkHref = LinkProps<string>["href"];

interface FeatureBannerProps {
  badge: string;
  title: string;
  imageId: string;
  glass?: boolean;
  ctas: { label: string; href: LinkHref }[];
}

const blur = buildBlurPlaceholder("#0a0a0a");
const sizes = buildSizesAttribute("hero");

export function FeatureBanner({
  badge,
  title,
  imageId,
  ctas,
  glass = false,
}: FeatureBannerProps): JSX.Element {
  const imageSrc = buildCloudinaryUrl({
    publicId: imageId,
    transformations: ["c_fill,g_auto,f_auto,q_auto:good,w_1920,h_1080"],
  });

  return (
    <section className="relative h-screen overflow-hidden bg-black text-white">
      <Image
        loader={cloudinaryImageLoader}
        src={imageSrc}
        alt={title}
        fill
        sizes={sizes}
        placeholder="blur"
        blurDataURL={blur}
        className="object-cover opacity-60"
        priority={false}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/35 to-black/75" />
      <div className={cn("absolute inset-0", glass && "bg-white/5 backdrop-blur-sm")} />

      <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
        <div className="max-w-3xl space-y-4">
          <span className="text-[10px] font-bold uppercase tracking-[0.32em]">{badge}</span>
          <h3 className="text-4xl font-light uppercase tracking-[0.26em] drop-shadow-[0_18px_40px_rgba(0,0,0,0.45)] md:text-5xl">
            {title}
          </h3>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6">
            {ctas.map((cta) => (
              <CtaLink key={cta.label} href={cta.href} label={cta.label} tone="light" />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
