"use client";

/* istanbul ignore file */
import type { ComponentPropsWithoutRef, ReactElement } from "react";

import Image from "next/image";

import { cloudinaryImageLoader } from "@/lib/image-loader";

import { ImagePlaceholder } from "./ImagePlaceholder";

/* istanbul ignore file */

export type ResponsiveImageProps = ComponentPropsWithoutRef<typeof Image> & {
  fallbackSrc?: string;
  fallbackLabel?: string;
};

export function ResponsiveImage({
  src,
  alt,
  fallbackSrc,
  fallbackLabel,
  width,
  height,
  ...rest
}: ResponsiveImageProps): ReactElement {
  if (!src && !fallbackSrc) {
    return (
      <ImagePlaceholder
        width={Number(width) || 160}
        height={Number(height) || 160}
        label={fallbackLabel}
      />
    );
  }

  const resolvedSrc = src ?? fallbackSrc ?? "";
  const resolvedAlt = alt ?? "Media image";

  return (
    <Image
      loader={cloudinaryImageLoader}
      src={resolvedSrc}
      alt={resolvedAlt}
      width={width}
      height={height}
      {...rest}
    />
  );
}
