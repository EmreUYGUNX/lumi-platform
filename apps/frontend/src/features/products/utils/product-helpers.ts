import { buildCloudinaryUrl } from "@/lib/cloudinary";

import type { ProductSummary } from "../types/product.types";

export type ProductAvailability = "in_stock" | "low_stock" | "out_of_stock";
export type ProductVariant = ProductSummary["variants"][number];

const fallbackImage = buildCloudinaryUrl({
  publicId: "sample",
  transformations: ["c_fill,g_auto,f_auto,q_auto:eco,w_960,h_1280"],
});

export const resolveProductMedia = (
  product: ProductSummary,
): { src: string; alt: string; provider?: string } => {
  const primary = product.media.find((item) => item.isPrimary)?.media ?? product.media[0]?.media;
  if (primary?.url) {
    return { src: primary.url, alt: primary.alt ?? product.title, provider: primary.provider };
  }

  return {
    src: fallbackImage,
    alt: product.title,
  };
};

export const deriveProductAvailability = (product: ProductSummary): ProductAvailability => {
  const totalStock = product.variants.reduce((sum, variant) => sum + (variant.stock ?? 0), 0);
  if (totalStock <= 0) return "out_of_stock";
  if (totalStock <= 5) return "low_stock";
  return "in_stock";
};

export const getPrimaryVariant = (product: ProductSummary): ProductVariant | undefined =>
  product.variants.find((variant) => variant.isPrimary) ?? product.variants[0];

export const getPreferredVariant = (product: ProductSummary): ProductVariant | undefined => {
  const available = product.variants.find((variant) => (variant.stock ?? 0) > 0);
  if (available) return available;
  return getPrimaryVariant(product);
};
