"use client";

"use client";

import { useEffect, useRef } from "react";

import { ChevronLeft, ChevronRight } from "lucide-react";

import Image from "next/image";
import Link, { type LinkProps } from "next/link";

import { buildBlurPlaceholder, buildCloudinaryUrl, buildSizesAttribute } from "@/lib/cloudinary";
import { cloudinaryImageLoader } from "@/lib/image-loader";
import { cn } from "@/lib/utils";

type LinkHref = LinkProps<string>["href"];

interface SliderItem {
  title: string;
  href: LinkHref;
  imageId: string;
}

interface CollectionsSliderProps {
  items: SliderItem[];
}

const blur = buildBlurPlaceholder("#0a0a0a");
const imageSizes = buildSizesAttribute(undefined, "(max-width: 768px) 100vw, 33vw");

export function CollectionsSlider({ items }: CollectionsSliderProps): JSX.Element {
  const sliderRef = useRef<HTMLDivElement | null>(null);
  const isHoveredRef = useRef(false);

  const scrollBy = (direction: "next" | "prev") => {
    const slider = sliderRef.current;
    if (!slider) return;
    const distance = slider.clientWidth * (direction === "next" ? 1 : -1);
    slider.scrollBy({ left: distance, behavior: "smooth" });
  };

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (isHoveredRef.current) return;
      scrollBy("next");
    }, 5500);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <section className="relative h-[85vh] overflow-hidden bg-black text-white">
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/5" />
      <div
        ref={sliderRef}
        className={cn(
          "relative flex h-full snap-x snap-mandatory items-stretch overflow-x-auto scroll-smooth",
          "[-ms-overflow-style:none] [scrollbar-width:none] md:gap-0 [&::-webkit-scrollbar]:hidden",
        )}
        onMouseEnter={() => {
          isHoveredRef.current = true;
        }}
        onMouseLeave={() => {
          isHoveredRef.current = false;
        }}
      >
        {items.map((item) => {
          const imageSrc = buildCloudinaryUrl({
            publicId: item.imageId,
            transformations: ["c_fill,g_auto,f_auto,q_auto:eco,w_1600,h_1200"],
          });

          return (
            <Link
              key={item.title}
              href={item.href}
              className="group relative flex min-w-full snap-center items-center justify-center md:min-w-[33.333%]"
              aria-label={`Navigate to ${item.title}`}
              prefetch
            >
              <Image
                loader={cloudinaryImageLoader}
                src={imageSrc}
                alt={item.title}
                fill
                sizes={imageSizes}
                placeholder="blur"
                blurDataURL={blur}
                className="object-cover opacity-70 transition duration-700 group-hover:opacity-90"
                priority={false}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-10 text-center">
                <p className="text-2xl font-bold uppercase tracking-[0.32em] drop-shadow-[0_8px_24px_rgba(0,0,0,0.5)] md:text-3xl">
                  {item.title}
                </p>
              </div>
              <div className="absolute inset-y-0 right-0 w-px bg-white/10" />
            </Link>
          );
        })}
      </div>

      <button
        type="button"
        className="absolute left-6 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-white/10 p-3 backdrop-blur-md transition hover:bg-white/20 md:flex"
        aria-label="Previous collection"
        onClick={() => scrollBy("prev")}
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        className="absolute right-6 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-white/10 p-3 backdrop-blur-md transition hover:bg-white/20 md:flex"
        aria-label="Next collection"
        onClick={() => scrollBy("next")}
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </section>
  );
}
