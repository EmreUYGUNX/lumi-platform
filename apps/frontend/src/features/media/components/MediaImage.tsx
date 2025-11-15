"use client";

/* eslint-disable unicorn/no-useless-undefined */

/* istanbul ignore file */
import type { ComponentPropsWithoutRef, ReactElement, SyntheticEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import { ImagePlaceholder } from "@/components/ui/image/ImagePlaceholder";
import { ImageSkeleton } from "@/components/ui/image/ImageSkeleton";
import { ResponsiveImage } from "@/components/ui/image/ResponsiveImage";
import { initMediaPerformanceTelemetry } from "@/features/media/utils/media-telemetry";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";
import {
  CLOUDINARY_BREAKPOINTS,
  type CloudinaryDisplayPreset,
  buildBlurPlaceholder,
  buildCloudinaryUrl,
  buildSizesAttribute,
  buildSrcSet,
  resolveSizesFromWidth,
} from "@/lib/cloudinary";

import type { MediaAsset } from "../types/media.types";

/* istanbul ignore file */

export interface MediaArtDirectionRule {
  media: string;
  width?: number;
  height?: number;
  crop?: string;
  widths?: readonly number[];
  sizes?: string;
  transformations?: string[];
}

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
  /**
   * Custom art direction rules applied to the generated <picture> sources.
   * If omitted, sensible defaults per variant will be used.
   */
  artDirections?: readonly MediaArtDirectionRule[];
  /**
   * Enables visibility-based lazy loading via IntersectionObserver. Enabled by default.
   */
  observeVisibility?: boolean;
  /**
   * Custom root margin for the visibility observer (e.g. "300px").
   */
  lazyRootMargin?: string;
}

const DEFAULT_ART_DIRECTION_MAP = new Map<MediaImageVariant, readonly MediaArtDirectionRule[]>([
  [
    "thumbnail",
    [
      {
        media: "(max-width: 768px)",
        width: 480,
        height: 480,
        crop: "fill",
        widths: [320, 480, 640],
      },
      {
        media: "(min-width: 769px)",
        width: 640,
        height: 400,
        crop: "fill",
        widths: [640, 768, 1024],
      },
    ],
  ],
  [
    "medium",
    [
      {
        media: "(max-width: 1024px)",
        width: 1024,
        height: 768,
        crop: "limit",
      },
    ],
  ],
  [
    "large",
    [
      {
        media: "(max-width: 1280px)",
        width: 1280,
        height: 720,
        crop: "limit",
      },
      {
        media: "(min-width: 1281px)",
        width: 1920,
        height: 1080,
        crop: "limit",
      },
    ],
  ],
]);

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

const buildResponsiveSrcSet = (
  transformations: Record<string, string> | undefined,
  fallback?: {
    publicId?: string;
    src?: string;
    width?: number;
    height?: number;
    transformations?: string[];
  },
): string | undefined => {
  const entries: { width: number; url: string }[] = [];
  // eslint-disable-next-line security/detect-object-injection -- Keys originate from trusted backend.
  Object.entries(transformations ?? {}).forEach(([key, value]) => {
    const match = key.match(/^responsive_(\d+)$/u);
    if (!match) {
      return;
    }
    const width = Number.parseInt(match[1] ?? "", 10);
    if (!Number.isFinite(width)) {
      return;
    }
    entries.push({ width, url: value });
  });
  entries.sort((left, right) => left.width - right.width);

  if (entries.length === 0) {
    if (!fallback?.publicId && !fallback?.src) {
      return undefined;
    }

    const srcSet = buildSrcSet({
      publicId: fallback.publicId,
      src: fallback.src,
      width: fallback.width,
      height: fallback.height,
      transformations: fallback.transformations,
      widths: CLOUDINARY_BREAKPOINTS,
    });

    return srcSet ?? undefined;
  }

  return entries.map(({ width, url }) => `${url} ${width}w`).join(", ");
};

/* eslint-disable-next-line sonarjs/cognitive-complexity */
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
  artDirections,
  observeVisibility = true,
  lazyRootMargin = "320px",
  ...rest
}: MediaImageProps): ReactElement {
  const [isBroken, setBroken] = useState(false);
  const derivedDimensions = resolveDimensions(asset);
  const resolvedWidth = width ?? derivedDimensions.width;
  const resolvedHeight = height ?? derivedDimensions.height;
  const preset: CloudinaryDisplayPreset = display ?? resolveSizesFromWidth(resolvedWidth);
  const sizes = buildSizesAttribute(preset, rest.sizes, resolvedWidth);

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
    if (asset?.metadata && typeof asset.metadata === "object") {
      const metadataRecord = asset.metadata as Record<string, unknown>;
      const stored = metadataRecord.blurDataUrl;
      if (typeof stored === "string" && stored.startsWith("data:")) {
        return stored;
      }
    }

    const color = fallbackColor ?? resolveMetadataColor(asset);
    if (!color) {
      return undefined;
    }

    return buildBlurPlaceholder(color);
  }, [asset, fallbackColor]);

  const resolvedAlt =
    rest.alt ??
    resolveMetadataText(asset, "alt") ??
    resolveMetadataText(asset, "caption") ??
    asset?.tags?.join(", ") ??
    "Media asset";

  const basePublicId = useMemo(() => asset?.publicId ?? publicId, [asset?.publicId, publicId]);
  const responsiveSrcSet = useMemo(() => {
    if (!asset?.transformations && !basePublicId) {
      return undefined;
    }

    return buildResponsiveSrcSet(asset?.transformations, {
      publicId: basePublicId ? String(basePublicId) : undefined,
      width: resolvedWidth,
      height: resolvedHeight,
      transformations,
    });
  }, [asset?.transformations, basePublicId, resolvedHeight, resolvedWidth, transformations]);

  const directionRules = useMemo(() => {
    if (artDirections) {
      return artDirections;
    }
    return DEFAULT_ART_DIRECTION_MAP.get(variant) ?? [];
  }, [artDirections, variant]);

  const artDirectionSources = useMemo(() => {
    if (directionRules.length === 0 || !basePublicId) {
      return [];
    }

    return directionRules
      .map((rule) => {
        const srcSet = buildSrcSet({
          publicId: String(basePublicId),
          width: rule.width,
          height: rule.height,
          crop: rule.crop,
          widths: rule.widths,
          transformations: rule.transformations ?? transformations,
        });

        if (!srcSet) {
          return undefined;
        }

        return {
          media: rule.media,
          sizes: rule.sizes ?? sizes,
          srcSet,
        };
      })
      .filter(
        (
          entry,
        ): entry is {
          media: string;
          sizes: string;
          srcSet: string;
        } => entry !== undefined,
      );
  }, [basePublicId, directionRules, sizes, transformations]);

  const observer = useIntersectionObserver<HTMLDivElement>({
    disabled: !observeVisibility || priority,
    rootMargin: lazyRootMargin,
    threshold: 0.15,
  });

  useEffect(() => {
    if (priority) {
      initMediaPerformanceTelemetry();
    }
  }, [priority]);

  const isServer = typeof window === "undefined";
  const shouldRenderViaObserver =
    priority || !observeVisibility || isServer || observer.isIntersecting;

  if (!finalSource || isBroken) {
    return <ImagePlaceholder width={resolvedWidth} height={resolvedHeight} label={fallbackLabel} />;
  }

  if (!shouldRenderViaObserver) {
    return (
      <div ref={observer.ref} aria-live="polite" aria-busy>
        <ImageSkeleton width={resolvedWidth} height={resolvedHeight} />
      </div>
    );
  }

  return (
    <picture>
      {artDirectionSources.map((source) => (
        <source
          key={source.media}
          media={source.media}
          sizes={source.sizes}
          srcSet={source.srcSet}
        />
      ))}
      {responsiveSrcSet ? <source sizes={sizes} srcSet={responsiveSrcSet} /> : undefined}
      <ResponsiveImage
        {...rest}
        decoding="async"
        fetchPriority={priority ? "high" : rest.fetchPriority}
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
    </picture>
  );
}
