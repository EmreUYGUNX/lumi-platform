import type {
  ProductDetail,
  ProductReviewStats,
} from "@/features/product/types/product-detail.types";
import type { ProductSummaryDTO } from "@lumi/shared/dto";

import { buildAbsoluteUrl, siteUrl } from "./metadata";

type ProductForSchema = ProductDetail["product"] | ProductSummaryDTO;

const SCHEMA_CONTEXT = "https://schema.org";

const isAbsoluteUrl = (value: string): boolean => /^https?:\/\//iu.test(value);

const toAbsoluteUrl = (value: string): string =>
  isAbsoluteUrl(value) ? value : buildAbsoluteUrl(value);

const deriveBrand = (product: ProductForSchema): string => {
  const attributes = product.attributes as Record<string, unknown> | undefined;
  const brand = attributes?.brand;

  if (typeof brand === "string" && brand.trim()) {
    return brand.trim();
  }

  if (Array.isArray(brand)) {
    const primaryBrand = brand.find((entry) => typeof entry === "string" && entry.trim());
    if (typeof primaryBrand === "string") {
      return primaryBrand.trim();
    }
  }

  return "Lumi";
};

const deriveAvailabilityUrl = (product: ProductForSchema): string => {
  let totalStock = 0;
  product.variants.forEach((variant) => {
    totalStock += Number(variant.stock ?? 0);
  });

  if (totalStock <= 0) return "https://schema.org/OutOfStock";
  if (totalStock <= 5) return "https://schema.org/LimitedAvailability";
  return "https://schema.org/InStock";
};

const normaliseDescription = (value: string | null | undefined): string =>
  (value ?? "").replaceAll(/\s+/gu, " ").trim();

export const buildProductSchema = ({
  product,
  reviews,
  url,
  brand,
}: {
  product: ProductForSchema;
  reviews?: ProductReviewStats;
  url?: string;
  brand?: string;
}): Record<string, unknown> => {
  const productUrl = url ?? `/products/${product.slug}`;
  const absoluteUrl = buildAbsoluteUrl(productUrl);
  const images =
    product.media?.map((entry) => toAbsoluteUrl(entry.media.url)).filter(Boolean) ?? [];
  const aggregateRating =
    reviews && reviews.totalReviews > 0
      ? {
          "@type": "AggregateRating",
          ratingValue: Number(reviews.averageRating.toFixed(1)),
          reviewCount: reviews.totalReviews,
        }
      : undefined;

  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "Product",
    name: product.title,
    description: normaliseDescription(product.summary ?? product.description ?? ""),
    sku: product.sku ?? undefined,
    image: images,
    brand: {
      "@type": "Brand",
      name: brand ?? deriveBrand(product),
    },
    offers: {
      "@type": "Offer",
      price: product.price.amount,
      priceCurrency: product.price.currency,
      availability: deriveAvailabilityUrl(product),
      url: absoluteUrl,
    },
    aggregateRating,
  };
};

export interface BreadcrumbEntry {
  name: string;
  url: string;
  position?: number;
}

export const buildBreadcrumbSchema = (items: BreadcrumbEntry[]): Record<string, unknown> => ({
  "@context": SCHEMA_CONTEXT,
  "@type": "BreadcrumbList",
  itemListElement: items.map((entry, index) => ({
    "@type": "ListItem",
    position: entry.position ?? index + 1,
    name: entry.name,
    item: buildAbsoluteUrl(entry.url),
  })),
});

export const buildOrganizationSchema = (logoUrl?: string): Record<string, unknown> => ({
  "@context": SCHEMA_CONTEXT,
  "@type": "Organization",
  name: "Lumi",
  url: siteUrl,
  ...(logoUrl ? { logo: toAbsoluteUrl(logoUrl) } : {}),
});

export const buildSearchActionSchema = (): Record<string, unknown> => ({
  "@type": "SearchAction",
  target: `${siteUrl}/search?q={search_term_string}`,
  "query-input": "required name=search_term_string",
});

export const buildWebSiteSchema = (): Record<string, unknown> => ({
  "@context": SCHEMA_CONTEXT,
  "@type": "WebSite",
  url: siteUrl,
  name: "Lumi Commerce",
  potentialAction: buildSearchActionSchema(),
});
