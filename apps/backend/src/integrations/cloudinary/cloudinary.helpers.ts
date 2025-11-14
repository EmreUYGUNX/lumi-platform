import type { UploadApiOptions } from "cloudinary";

import type { CloudinaryDeliveryDefaults } from "@lumi/types";

export type CloudinaryTransformationDefinition = Exclude<
  NonNullable<UploadApiOptions["transformation"]>,
  string
>;

export interface CloudinaryEagerTransformation {
  width?: number;
  height?: number;
  crop?: string;
  quality?: string;
  format?: string;
  fetch_format?: string;
  dpr?: string | number;
  flags?: string | string[];
}

const BASE_EAGER_TRANSFORMATIONS: readonly Omit<
  CloudinaryEagerTransformation,
  "quality" | "format" | "fetch_format"
>[] = Object.freeze([
  {
    width: 300,
    height: 300,
    crop: "fill",
  },
  {
    width: 800,
    height: 800,
    crop: "limit",
  },
  {
    width: 1920,
    crop: "limit",
  },
]);

export const buildDefaultDeliveryTransformation = (
  defaults: CloudinaryDeliveryDefaults,
): CloudinaryTransformationDefinition => ({
  fetch_format: defaults.fetchFormat,
  quality: defaults.quality,
  format: defaults.format,
  dpr: defaults.dpr,
});

export const buildEagerTransformations = (
  defaults: CloudinaryDeliveryDefaults,
): readonly CloudinaryEagerTransformation[] =>
  BASE_EAGER_TRANSFORMATIONS.map((transformation) => ({
    ...transformation,
    quality: defaults.quality,
    format: defaults.format,
    fetch_format: defaults.fetchFormat,
  }));
