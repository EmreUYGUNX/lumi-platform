import type { Metadata } from "next";

import { notFound } from "next/navigation";

import { apiClient } from "@/lib/api-client";
import { ProductDetailPage } from "@/features/product/components/ProductDetailPage";
import type { ProductDetail } from "@/features/product/types/product-detail.types";
import { productDetailSchema } from "@/features/product/types/product-detail.types";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://lumi-commerce.dev";

const fetchProductDetail = async (slug: string): Promise<ProductDetail | undefined> => {
  try {
    const response = await apiClient.get(`/catalog/products/${encodeURIComponent(slug)}`, {
      dataSchema: productDetailSchema,
      retry: 1,
    });
    return response.data;
  } catch {
    return undefined;
  }
};

const deriveBrand = (product: ProductDetail["product"]): string | undefined => {
  const attributes = product.attributes as Record<string, unknown> | undefined;
  if (!attributes) {
    return undefined;
  }
  const { brand } = attributes;
  if (typeof brand === "string") {
    return brand;
  }
  if (Array.isArray(brand) && typeof brand[0] === "string") {
    return brand[0];
  }
  return undefined;
};

const deriveAvailabilityUrl = (product: ProductDetail["product"]): string => {
  let totalStock = 0;
  product.variants.forEach((variant) => {
    totalStock += variant.stock ?? 0;
  });
  if (totalStock <= 0) return "https://schema.org/OutOfStock";
  if (totalStock <= 5) return "https://schema.org/LimitedAvailability";
  return "https://schema.org/InStock";
};

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const slug = decodeURIComponent(resolvedParams.slug);
  const detail = await fetchProductDetail(slug);
  if (!detail) {
    return {
      title: "Product not found | Lumi",
      description: "The product you are looking for is unavailable.",
    };
  }

  const { product } = detail;
  const primaryImage =
    product.media.find((item) => item.isPrimary)?.media.url ?? product.media[0]?.media.url;
  const url = `${SITE_URL}/products/${slug}`;

  return {
    title: `${product.title} | Lumi`,
    description: product.summary ?? product.description ?? "Premium Lumi commerce product detail.",
    alternates: { canonical: url },
    openGraph: {
      title: `${product.title} | Lumi`,
      description: product.summary ?? undefined,
      url,
      images: primaryImage ? [primaryImage] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: `${product.title} | Lumi`,
      description: product.summary ?? undefined,
      images: primaryImage ? [primaryImage] : undefined,
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps): Promise<JSX.Element> {
  const resolvedParams = await params;
  const slug = decodeURIComponent(resolvedParams.slug);
  const detail = await fetchProductDetail(slug);

  if (!detail) {
    notFound();
    return <></>;
  }

  const { product } = detail;
  const brand = deriveBrand(product) ?? "Lumi";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    image: product.media.map((entry) => entry.media.url),
    description: product.summary ?? product.description ?? "",
    sku: product.sku ?? "",
    brand: {
      "@type": "Brand",
      name: brand,
    },
    offers: {
      "@type": "Offer",
      price: product.price.amount,
      priceCurrency: product.price.currency,
      availability: deriveAvailabilityUrl(product),
      url: `${SITE_URL}/products/${slug}`,
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: detail.reviews.averageRating || 0,
      reviewCount: detail.reviews.totalReviews || 0,
    },
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: SITE_URL,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Products",
        item: `${SITE_URL}/products`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: product.title,
        item: `${SITE_URL}/products/${slug}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <ProductDetailPage slug={slug} initialData={detail} />
    </>
  );
}
