"use client";

/* istanbul ignore file */
import type { ComponentPropsWithoutRef, ReactElement, SyntheticEvent } from "react";
import { useMemo, useState } from "react";

import { ImagePlaceholder } from "@/components/ui/image/ImagePlaceholder";
import { ResponsiveImage } from "@/components/ui/image/ResponsiveImage";
import {
  type CloudinaryDisplayPreset,
  buildBlurPlaceholder,
  buildCloudinaryUrl,
  buildSizesAttribute,
  resolveSizesFromWidth,
} from "@/lib/cloudinary";

import type { MediaAsset } from "../types/media.types";

/* istanbul ignore file */

export type MediaImageVariant = "thumbnail" | "medium" | "large";

export interface MediaImageProps
  extends Omit<
    ComponentPropsWithoutRef<typeof ResponsiveImage>,
    "src" | "width" | "height" | "alt"
  > {
  asset?: MediaAsset | null;
  publicId?: string;
  src?: string;
  width?: number;
  height?: number;
  variant?: MediaImageVariant;
  display?: CloudinaryDisplayPreset;
  fallbackLabel?: string;
  fallbackColor?: string;
  transformations?: string[];
  alt?: string;
}

const resolveMetadataColor = (asset?: MediaAsset | null): string | undefined => {
  if (!asset?.metadata || typeof asset.metadata !== "object") {
    return undefined;
  }

  const metadataRecord = asset.metadata as Record<string, unknown>;
  const candidate = metadataRecord.dominantColor;

  if (typeof candidate === "string" && candidate.length > 3) {
    return candidate;
  }

  return undefined;
};

const SUPPORTED_METADATA_KEYS = new Set(["alt", "caption"]);

const resolveMetadataText = (asset?: MediaAsset | null, key?: string): string | undefined => {
  if (
    !asset ||
    !key ||
    !SUPPORTED_METADATA_KEYS.has(key) ||
    !asset.metadata ||
    typeof asset.metadata !== "object"
  ) {
    return undefined;
  }

  const store = asset.metadata as {
    alt?: unknown;
    caption?: unknown;
  };

  const value = key === "alt" ? store.alt : store.caption;

  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }

  return undefined;
};

const pickVariantUrl = (
  asset?: MediaAsset | null,
  variant?: MediaImageVariant,
): string | undefined => {
  if (!asset) {
    return undefined;
  }

  if (variant === "thumbnail" && asset.transformations?.thumbnail) {
    return asset.transformations.thumbnail;
  }

  if (variant === "large" && asset.transformations?.large) {
    return asset.transformations.large;
  }

  if (variant === "medium" && asset.transformations?.medium) {
    return asset.transformations.medium;
  }

  return asset.secureUrl ?? asset.url;
};

const resolveDimensions = (asset?: MediaAsset | null): { width: number; height: number } => {
  const width = asset?.width && asset.width > 0 ? asset.width : 1200;
  const height = asset?.height && asset.height > 0 ? asset.height : Math.round(width * 0.66);
  return { width, height };
};

export function MediaImage({
  asset,
  publicId,
  src,
  width,
  height,
  variant = "medium",
  display,
  fallbackLabel = "Image unavailable",
  fallbackColor,
  transformations,
  priority,
  loading,
  ...rest
}: MediaImageProps): ReactElement {
  const [isBroken, setBroken] = useState(false);
  const derivedDimensions = resolveDimensions(asset);
  const resolvedWidth = width ?? derivedDimensions.width;
  const resolvedHeight = height ?? derivedDimensions.height;
  const preset: CloudinaryDisplayPreset = display ?? resolveSizesFromWidth(resolvedWidth);
  const sizes = buildSizesAttribute(preset, rest.sizes);

  const variantSource = useMemo(() => pickVariantUrl(asset, variant), [asset, variant]);

  const baseSource = variantSource ?? src ?? publicId ?? asset?.publicId;

  const finalSource = useMemo(() => {
    if (!publicId || variantSource) {
      return baseSource;
    }

    return buildCloudinaryUrl({
      publicId,
      width: resolvedWidth,
      height: resolvedHeight,
      transformations,
    });
  }, [baseSource, publicId, resolvedHeight, resolvedWidth, transformations, variantSource]);

  const blurDataURL = useMemo(() => {
    const color = fallbackColor ?? resolveMetadataColor(asset);
    return color ? buildBlurPlaceholder(color) : undefined;
  }, [asset, fallbackColor]);

  const resolvedAlt =
    rest.alt ??
    resolveMetadataText(asset, "alt") ??
    resolveMetadataText(asset, "caption") ??
    asset?.tags?.join(", ") ??
    "Media asset";

  if (!finalSource || isBroken) {
    return <ImagePlaceholder width={resolvedWidth} height={resolvedHeight} label={fallbackLabel} />;
  }

  return (
    <ResponsiveImage
      {...rest}
      src={finalSource}
      alt={resolvedAlt}
      width={resolvedWidth}
      height={resolvedHeight}
      sizes={sizes}
      placeholder={blurDataURL ? "blur" : (rest.placeholder ?? "empty")}
      blurDataURL={blurDataURL}
      loading={loading ?? (priority ? "eager" : "lazy")}
      priority={priority}
      onError={(event: SyntheticEvent<HTMLImageElement>) => {
        rest.onError?.(event);
        setBroken(true);
      }}
    />
  );
}
