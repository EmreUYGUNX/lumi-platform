/* istanbul ignore file */
import type { ImageLoaderProps } from "next/image";

import { env } from "@/lib/env";
import { CLOUDINARY_BREAKPOINTS as SHARED_CLOUDINARY_BREAKPOINTS } from "@lumi/shared/media/cloudinary";

export const CLOUDINARY_BREAKPOINTS = SHARED_CLOUDINARY_BREAKPOINTS;

const DEFAULT_TRANSFORMATIONS = Object.freeze({
  format: "f_auto",
  quality: "q_auto:good",
  dpr: "dpr_auto",
  crop: "c_limit",
});

export type CloudinaryDisplayPreset = "thumbnail" | "gallery" | "detail" | "hero";

const resolveSizeTemplate = (preset: CloudinaryDisplayPreset): string => {
  switch (preset) {
    case "thumbnail": {
      return "(max-width: 768px) 50vw, 180px";
    }
    case "gallery": {
      return "(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw";
    }
    case "detail": {
      return "(max-width: 768px) 100vw, (max-width: 1280px) 75vw, 1200px";
    }
    default: {
      return "100vw";
    }
  }
};

export interface CloudinaryUrlOptions {
  src?: string;
  publicId?: string;
  width?: number;
  height?: number;
  quality?: number | string;
  format?: string;
  crop?: string;
  resourceType?: string;
  deliveryType?: string;
  dpr?: number | "auto";
  transformations?: string[];
  baseUrl?: string;
}

const getCloudName = (): string => env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

const encodePublicId = (value: string): string =>
  value
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

const isRemoteSource = (value: string): boolean => /^(https?:|data:|blob:)/iu.test(value);

const resolveSource = ({
  src,
  publicId,
}: Pick<CloudinaryUrlOptions, "src" | "publicId">): string | undefined => {
  if (src) {
    return src;
  }

  if (publicId) {
    return publicId;
  }

  return undefined;
};

const buildBaseUrl = ({ resourceType, deliveryType, baseUrl }: CloudinaryUrlOptions): string => {
  if (baseUrl) {
    return baseUrl.replace(/\/$/u, "");
  }

  const cloudName = getCloudName();
  const resolvedResource = resourceType ?? "image";
  const resolvedDelivery = deliveryType ?? "upload";

  return `https://res.cloudinary.com/${cloudName}/${resolvedResource}/${resolvedDelivery}`;
};

const mapTransformations = (options: CloudinaryUrlOptions): string => {
  const entries = new Map<string, string>();

  entries.set("format", DEFAULT_TRANSFORMATIONS.format);
  entries.set("quality", DEFAULT_TRANSFORMATIONS.quality);
  entries.set("dpr", DEFAULT_TRANSFORMATIONS.dpr);
  entries.set("crop", DEFAULT_TRANSFORMATIONS.crop);

  if (options.width) {
    entries.set("width", `w_${Math.round(options.width)}`);
  }

  if (options.height) {
    entries.set("height", `h_${Math.round(options.height)}`);
  }

  if (options.crop) {
    entries.set("crop", `c_${options.crop}`);
  }

  if (options.dpr) {
    entries.set("dpr", `dpr_${options.dpr}`);
  }

  if (options.quality) {
    entries.set("quality", `q_${options.quality}`);
  }

  if (options.format) {
    entries.set("format", `f_${options.format}`);
  }

  options.transformations?.forEach((value, index) => {
    entries.set(`custom_${index}`, value);
  });

  return [...entries.values()].filter(Boolean).join(",");
};

export const buildCloudinaryUrl = (options: CloudinaryUrlOptions): string => {
  const source = resolveSource(options);
  if (!source) {
    return "";
  }

  if (isRemoteSource(source)) {
    return source;
  }

  const trimmedSource = source.replaceAll(/^\/+/gu, "").replaceAll(/\/+$/gu, "");
  const encodedId = encodePublicId(trimmedSource);
  const baseUrl = buildBaseUrl(options);
  const transformation = mapTransformations(options);

  if (!transformation) {
    return `${baseUrl}/${encodedId}`;
  }

  return `${baseUrl}/${transformation}/${encodedId}`;
};

const normaliseWidths = (widths?: readonly number[]): number[] => {
  if (!widths || widths.length === 0) {
    return [...CLOUDINARY_BREAKPOINTS];
  }

  const unique = new Set<number>();
  return widths
    .map((width) => Math.max(1, Math.round(width)))
    .filter((width) => {
      if (unique.has(width)) {
        return false;
      }
      unique.add(width);
      return true;
    })
    .sort((left, right) => left - right);
};

const buildSizesFromBreakpoints = (targetWidth: number): string => {
  const clampedWidth = Math.max(1, Math.round(targetWidth));
  const descriptors = CLOUDINARY_BREAKPOINTS.map(
    (breakpoint) => `(max-width: ${breakpoint}px) ${Math.min(breakpoint, clampedWidth)}px`,
  );

  return `${descriptors.join(", ")}, ${clampedWidth}px`;
};

export const buildSizesAttribute = (
  preset?: CloudinaryDisplayPreset,
  custom?: string,
  targetWidth?: number,
): string => {
  if (custom) {
    return custom;
  }

  if (targetWidth) {
    return buildSizesFromBreakpoints(targetWidth);
  }

  const resolvedPreset = preset ?? "gallery";
  return resolveSizeTemplate(resolvedPreset);
};

export interface CloudinarySrcSetOptions extends CloudinaryUrlOptions {
  widths?: readonly number[];
}

export const buildSrcSet = (options: CloudinarySrcSetOptions): string => {
  const selectedWidths = normaliseWidths(options.widths);
  const source = resolveSource(options);

  if (!source && !options.publicId) {
    return "";
  }

  return selectedWidths
    .map((width) => {
      const url = buildCloudinaryUrl({
        ...options,
        width,
      });

      return url ? `${url} ${width}w` : "";
    })
    .filter((entry) => entry.length > 0)
    .join(", ");
};

const encodeSvg = (svg: string): string => {
  if (typeof window === "undefined") {
    return Buffer.from(svg).toString("base64");
  }

  const normalized = encodeURIComponent(svg).replaceAll(/%([\dA-F]{2})/gu, (_, hex: string) =>
    String.fromCodePoint(Number.parseInt(hex, 16)),
  );

  return window.btoa(normalized);
};

export const buildBlurPlaceholder = (color: string): string => {
  const safeColor = color?.startsWith("#") ? color.slice(1) : color;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 9'><rect width='16' height='9' fill='%23${safeColor}'/><filter id='b'><feGaussianBlur stdDeviation='12'/></filter><rect width='16' height='9' filter='url(%23b)' fill='%23${safeColor}'/></svg>`;
  return `data:image/svg+xml;base64,${encodeSvg(svg)}`;
};

export type CloudinaryLoaderFactoryOptions = Partial<CloudinaryUrlOptions>;

export const createCloudinaryLoader = (
  defaults: CloudinaryLoaderFactoryOptions = {},
): ((props: ImageLoaderProps) => string) => {
  return ({ src, width, quality }: ImageLoaderProps) =>
    buildCloudinaryUrl({
      src,
      width,
      quality,
      ...defaults,
    });
};

export const cloudinaryLoader = createCloudinaryLoader();

export const resolveSizesFromWidth = (width?: number): CloudinaryDisplayPreset => {
  if (!width || width > 1280) {
    return "hero";
  }

  if (width > 768) {
    return "detail";
  }

  if (width > 480) {
    return "gallery";
  }

  return "thumbnail";
};
