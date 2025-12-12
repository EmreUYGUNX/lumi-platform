import { buildCloudinaryUrl } from "@/lib/cloudinary";

import type { ProductSummary } from "../types/product.types";

export type ProductAvailability = "in_stock" | "low_stock" | "out_of_stock";
export type ProductVariant = ProductSummary["variants"][number];

// Ordered fallback pool based on the user-provided Cloudinary uploads.
const FALLBACK_ASSETS = [
  "lumi/products/jeans-428614_1920_uflws5",
  "lumi/products/jeans-3051102_1920_hsp61l",
  "lumi/products/kid-7471803_1920_snjfnd",
  "lumi/products/neon-8726714_1920_fcykgq",
  "lumi/products/guy-598180_1920_qfemem",
  "lumi/products/tshirt-8726716_1920_oawa3r",
  "lumi/products/stand-5126363_1920_enrcp9",
  "lumi/products/male-5321547_1920_zy5nsm",
  "lumi/products/young-girl-7409676_1920_ostddl",
  "lumi/products/people-2592339_1920_wxtia8",
  "lumi/products/ai-generated-9565195_1920_dcn8pe",
  "lumi/products/t-shirt-3995093_1920_dijocp",
];

const FALLBACK_TRANSFORMATIONS = ["c_fill,g_auto,f_auto,q_auto:eco,w_960,h_1280"];

// Use Cloudinary demo asset as a final safety net (should never be hit if above list exists).
const defaultPlaceholder = buildCloudinaryUrl({
  publicId: "sample",
  baseUrl: "https://res.cloudinary.com/demo/image/upload",
  transformations: FALLBACK_TRANSFORMATIONS,
});

const pickFallbackAsset = (product?: ProductSummary): string => {
  if (FALLBACK_ASSETS.length === 0) return defaultPlaceholder;
  if (!product?.id && !product?.slug) {
    return buildCloudinaryUrl({
      publicId: FALLBACK_ASSETS[0],
      transformations: FALLBACK_TRANSFORMATIONS,
    });
  }

  const key = [...(product?.id ?? product?.slug ?? "")].reduce(
    (sum, char) => sum + (char.codePointAt(0) ?? 0),
    0,
  );

  const asset = FALLBACK_ASSETS[key % FALLBACK_ASSETS.length];
  return buildCloudinaryUrl({
    publicId: asset,
    transformations: FALLBACK_TRANSFORMATIONS,
  });
};

export const getFallbackMedia = (product?: ProductSummary): { src: string; alt: string } => ({
  src: pickFallbackAsset(product),
  alt: product?.title ?? "Lumi product",
});

export const resolveProductMedia = (
  product: ProductSummary,
): { src: string; alt: string; provider?: string } => {
  const primary = product.media.find((item) => item.isPrimary)?.media ?? product.media[0]?.media;

  if (primary?.url) {
    return { src: primary.url, alt: primary.alt ?? product.title, provider: primary.provider };
  }

  return getFallbackMedia(product);
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
