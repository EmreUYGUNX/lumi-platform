"use client";

import { useMemo, useState, type MouseEvent, type KeyboardEvent } from "react";

import Image from "next/image";

import { cloudinaryImageLoader } from "@/lib/image-loader";
import { buildBlurPlaceholder } from "@/lib/cloudinary";
import { cn } from "@/lib/utils";

interface ImageZoomProps {
  src: string;
  alt: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
  onOpen?: () => void;
}

export function ImageZoom({
  src,
  alt,
  sizes,
  priority,
  className,
  onOpen,
}: ImageZoomProps): JSX.Element {
  const [isZooming, setIsZooming] = useState(false);
  const [backgroundPosition, setBackgroundPosition] = useState("50% 50%");
  const blur = useMemo(() => buildBlurPlaceholder("#0a0a0a"), []);

  const backgroundImage = useMemo(() => `url(${src})`, [src]);

  const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * 100;
    const y = ((event.clientY - bounds.top) / bounds.height) * 100;
    setBackgroundPosition(`${x.toFixed(1)}% ${y.toFixed(1)}%`);
  };

  return (
    <div
      className={cn(
        "border-lumi-border/60 bg-lumi-bg-secondary/50 group relative overflow-hidden rounded-2xl border shadow-lg",
        className,
      )}
      onMouseEnter={() => setIsZooming(true)}
      onMouseLeave={() => setIsZooming(false)}
      onMouseMove={handleMouseMove}
      onClick={onOpen}
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : -1}
      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
        if (onOpen && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <div
        aria-hidden
        className="absolute inset-0 transition duration-500"
        style={{
          backgroundImage,
          backgroundSize: isZooming ? "170%" : "120%",
          backgroundPosition,
          filter: "grayscale(0.04)",
        }}
      />

      <div className="relative">
        <Image
          loader={cloudinaryImageLoader}
          src={src}
          alt={alt}
          sizes={sizes}
          priority={priority}
          width={1080}
          height={1350}
          placeholder="blur"
          blurDataURL={blur}
          loading={priority ? "eager" : "lazy"}
          className="aspect-[4/5] w-full object-cover mix-blend-multiply transition duration-500"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/5 opacity-0 transition duration-500 group-hover:opacity-100" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/25 to-transparent" />
        <p className="text-lumi-text-secondary absolute bottom-3 right-3 rounded-full bg-white/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] shadow-sm">
          Hover to zoom
        </p>
      </div>
    </div>
  );
}
