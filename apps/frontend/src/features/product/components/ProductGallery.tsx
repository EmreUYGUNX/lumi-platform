/* eslint-disable jsx-a11y/media-has-caption */

"use client";

import { useEffect, useMemo, useRef, useState, type TouchEvent } from "react";

import { ChevronLeft, ChevronRight, Maximize2, Play } from "lucide-react";

import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { buildBlurPlaceholder, buildCloudinaryUrl, buildSizesAttribute } from "@/lib/cloudinary";
import { cloudinaryImageLoader } from "@/lib/image-loader";
import { cn } from "@/lib/utils";
import type { ProductSummary } from "@/features/products/types/product.types";
import { useSwipeScroll } from "@/hooks/useSwipeScroll";

import { ImageZoom } from "./ImageZoom";

interface GalleryMedia {
  id: string;
  url: string;
  alt: string;
  type: "image" | "video";
  isPrimary?: boolean;
}

const placeholder = buildCloudinaryUrl({
  publicId: "lumi/placeholders/product-fallback",
  transformations: ["c_fill,g_auto,f_auto,q_auto:eco,w_1080,h_1350"],
});

const blur = buildBlurPlaceholder("#0a0a0a");
const sizes = buildSizesAttribute("detail");

const deriveMedia = (product: ProductSummary | undefined): GalleryMedia[] => {
  if (!product?.media?.length) {
    return [
      {
        id: "placeholder",
        url: placeholder,
        alt: product?.title ?? "Product media",
        type: "image",
        isPrimary: true,
      },
    ];
  }

  const mapped = product.media.map((entry) => {
    const type =
      entry.media.type === "VIDEO" || entry.media.mimeType?.toLowerCase().startsWith("video")
        ? "video"
        : "image";

    return {
      id: entry.media.id,
      url: entry.media.url,
      alt: entry.media.alt ?? product.title,
      type,
      isPrimary: entry.isPrimary,
    } satisfies GalleryMedia;
  });

  return mapped.sort((left, right) => Number(right.isPrimary) - Number(left.isPrimary));
};

interface ProductGalleryProps {
  product?: ProductSummary;
  activeVariantId?: string;
}

export function ProductGallery({
  product,
  activeVariantId,
}: ProductGalleryProps): JSX.Element | null {
  const media = useMemo(() => deriveMedia(product), [product]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | undefined>();
  const thumbnailRef = useRef<HTMLDivElement | null>(null);
  useSwipeScroll(thumbnailRef);

  useEffect(() => {
    setActiveIndex(0);
  }, [product?.id, activeVariantId, media.length]);

  const handlePrev = () => {
    setActiveIndex((index) => (index === 0 ? media.length - 1 : index - 1));
  };

  const handleNext = () => {
    setActiveIndex((index) => (index === media.length - 1 ? 0 : index + 1));
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
      return;
    }

    if (event.key === "ArrowLeft") {
      handlePrev();
    } else if (event.key === "ArrowRight") {
      handleNext();
    }
  };

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media.length]);

  const clampedIndex = Math.min(Math.max(activeIndex, 0), Math.max(media.length - 1, 0));
  const current = media.at(clampedIndex) ??
    media[0] ?? {
      id: "fallback",
      url: placeholder,
      alt: "Product media",
      type: "image",
    };

  const onTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const firstTouch = event.changedTouches[0];
    if (!firstTouch) return;
    setTouchStartX(firstTouch.clientX);
  };

  const onTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (touchStartX === undefined) return;
    const firstTouch = event.changedTouches[0];
    if (!firstTouch) return;
    const deltaX = firstTouch.clientX - touchStartX;
    if (Math.abs(deltaX) < 20) return;

    if (deltaX > 0) {
      handlePrev();
    } else {
      handleNext();
    }
  };

  return (
    <div className="space-y-4">
      <div
        className="bg-lumi-bg-secondary/70 group relative overflow-hidden rounded-2xl"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {current.type === "video" ? (
          <div className="bg-lumi-text relative aspect-[4/5] w-full overflow-hidden rounded-2xl">
            <video
              controls
              playsInline
              className="h-full w-full object-cover"
              poster={media.find((item) => item.type === "image")?.url}
            >
              <source src={current.url} />
            </video>
          </div>
        ) : (
          <ImageZoom
            src={current.url}
            alt={current.alt}
            sizes={sizes}
            priority
            onOpen={() => setLightboxOpen(true)}
            className="aspect-[4/5] w-full"
          />
        )}

        {media.length > 1 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-between">
            <Button
              size="icon"
              variant="ghost"
              className="text-lumi-text pointer-events-auto ml-2 rounded-full bg-white/80 shadow-md backdrop-blur-sm hover:bg-white"
              onClick={handlePrev}
              aria-label="Önceki görsel"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="text-lumi-text pointer-events-auto mr-2 rounded-full bg-white/80 shadow-md backdrop-blur-sm hover:bg-white"
              onClick={handleNext}
              aria-label="Sonraki görsel"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="text-lumi-text absolute right-3 top-3 rounded-full border border-white/60 bg-white/80 shadow-md backdrop-blur"
          onClick={() => setLightboxOpen(true)}
          aria-label="Tam ekran görüntüle"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>

      <div
        ref={thumbnailRef}
        className="flex touch-pan-y snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {media.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveIndex(index)}
            className={cn(
              "relative aspect-[4/5] min-w-[88px] overflow-hidden rounded-xl border transition duration-300",
              index === activeIndex ? "border-lumi-text shadow-lg" : "border-lumi-border",
            )}
          >
            <Image
              loader={cloudinaryImageLoader}
              src={item.url}
              alt={item.alt}
              fill
              sizes="96px"
              placeholder="blur"
              blurDataURL={blur}
              className={cn(
                "object-cover mix-blend-multiply transition duration-300",
                index === activeIndex ? "scale-105" : "opacity-90",
              )}
            />
            {item.type === "video" && (
              <span className="bg-lumi-text/60 absolute inset-0 flex items-center justify-center text-white">
                <Play className="h-5 w-5" />
              </span>
            )}
          </button>
        ))}
      </div>

      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="border-lumi-border/60 bg-lumi-bg p-4 shadow-2xl sm:max-w-5xl">
          <div className="relative">
            {current.type === "video" ? (
              <div className="bg-lumi-text relative aspect-[4/5] w-full overflow-hidden rounded-xl">
                <video
                  controls
                  playsInline
                  className="h-full w-full object-contain"
                  src={current.url}
                >
                  <track kind="captions" />
                </video>
              </div>
            ) : (
              <div className="relative aspect-[4/5] w-full overflow-hidden rounded-xl">
                <Image
                  loader={cloudinaryImageLoader}
                  src={current.url}
                  alt={current.alt}
                  fill
                  sizes="(max-width: 1280px) 80vw, 1080px"
                  placeholder="blur"
                  blurDataURL={blur}
                  className="object-contain mix-blend-multiply"
                />
              </div>
            )}

            {media.length > 1 && (
              <div className="absolute inset-0 flex items-center justify-between px-2">
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-lumi-text rounded-full bg-white/70 shadow-lg hover:bg-white"
                  onClick={handlePrev}
                  aria-label="Önceki görsel"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-lumi-text rounded-full bg-white/70 shadow-lg hover:bg-white"
                  onClick={handleNext}
                  aria-label="Sonraki görsel"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
