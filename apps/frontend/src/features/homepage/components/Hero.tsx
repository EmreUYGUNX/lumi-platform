"use client";

import { useMemo, useRef } from "react";

import { ChevronDown } from "lucide-react";

import Image from "next/image";
import type { LinkProps } from "next/link";

import { useGSAP } from "@/animations/gsap";
import { buildBlurPlaceholder, buildCloudinaryUrl, buildSizesAttribute } from "@/lib/cloudinary";
import { cloudinaryImageLoader } from "@/lib/image-loader";
import { cn } from "@/lib/utils";

import { CtaLink } from "./CtaLink";

type LinkHref = LinkProps<string>["href"];

interface HeroProps {
  label: string;
  title: string;
  tagline: string;
  backgroundId: string;
  primaryCta: { label: string; href: LinkHref };
  secondaryCta: { label: string; href: LinkHref };
}

const blur = buildBlurPlaceholder("#0b1220");
const heroSizes = buildSizesAttribute("hero");

export function Hero({
  label,
  title,
  tagline,
  backgroundId,
  primaryCta,
  secondaryCta,
}: HeroProps): JSX.Element {
  const containerRef = useRef<HTMLElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const backgroundSrc = useMemo(
    () =>
      buildCloudinaryUrl({
        publicId: backgroundId,
        transformations: ["c_fill,g_auto,f_auto,q_auto:good,w_1920,h_1200"],
      }),
    [backgroundId],
  );

  useGSAP(
    ({ gsap, ScrollTrigger }) => {
      if (!containerRef.current || !imageRef.current || !ScrollTrigger) return;

      gsap.fromTo(
        imageRef.current,
        { scale: 1.08, yPercent: 8 },
        {
          scale: 1,
          yPercent: -10,
          ease: "none",
          scrollTrigger: {
            trigger: containerRef.current,
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        },
      );
    },
    containerRef,
    [backgroundSrc],
  );

  return (
    <section
      ref={containerRef}
      className="relative isolate flex h-[92vh] min-h-[720px] items-center justify-center overflow-hidden bg-black"
      aria-labelledby="homepage-hero"
    >
      <Image
        ref={imageRef}
        loader={cloudinaryImageLoader}
        src={backgroundSrc}
        alt={title}
        fill
        sizes={heroSizes}
        placeholder="blur"
        blurDataURL={blur}
        className="object-cover"
        priority
      />
      <div className="absolute inset-0 bg-black/10" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/20 to-black/65" />

      <div className="relative z-10 flex max-w-5xl flex-col items-center gap-6 px-6 text-center text-white">
        <p className="text-xs uppercase tracking-[0.28em] text-white/80 drop-shadow-[0_8px_22px_rgba(0,0,0,0.45)]">
          {label}
        </p>
        <h1
          id="homepage-hero"
          className={cn(
            "text-4xl font-light uppercase tracking-[0.3em] drop-shadow-[0_18px_44px_rgba(0,0,0,0.55)]",
            "sm:text-5xl md:text-6xl lg:text-7xl",
          )}
        >
          {title}
        </h1>
        <p className="text-sm uppercase tracking-[0.15em] text-white/75 sm:text-base md:max-w-3xl">
          {tagline}
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-6">
          <CtaLink href={primaryCta.href} label={primaryCta.label} tone="light" />
          <CtaLink href={secondaryCta.href} label={secondaryCta.label} tone="light" />
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-10 flex justify-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/30 bg-white/5 backdrop-blur-md">
          <ChevronDown className="h-5 w-5 animate-bounce text-white" />
        </div>
      </div>
    </section>
  );
}
