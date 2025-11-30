import type { Metadata } from "next";

import { notFound } from "next/navigation";

import { ProductDetailPage } from "@/features/product/components/ProductDetailPage";
import type { ProductDetail } from "@/features/product/types/product-detail.types";
import { productDetailSchema } from "@/features/product/types/product-detail.types";
import { apiClient } from "@/lib/api-client";
import { buildAbsoluteUrl, generateMetadata as buildMetadata } from "@/lib/seo/metadata";
import { buildBreadcrumbSchema, buildProductSchema } from "@/lib/seo/schema";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export const revalidate = 300;

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

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const slug = decodeURIComponent(resolvedParams.slug);
  const detail = await fetchProductDetail(slug);
  if (!detail) {
    return buildMetadata({
      title: "Product not found | Lumi",
      description: "The product you are looking for is unavailable.",
      path: `/products/${slug}`,
      twitterCard: "summary",
    });
  }

  const { product } = detail;
  const primaryImage =
    product.media.find((item) => item.isPrimary)?.media.url ?? product.media[0]?.media.url;

  return buildMetadata({
    title: `${product.title} | Lumi`,
    description: product.summary ?? product.description ?? "Premium Lumi commerce product detail.",
    path: `/products/${slug}`,
    image: primaryImage ? { url: primaryImage, alt: product.title } : undefined,
  });
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
  const jsonLd = buildProductSchema({
    product,
    reviews: detail.reviews,
    url: `/products/${slug}`,
  });

  const breadcrumbLd = buildBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Products", url: "/products" },
    { name: product.title, url: buildAbsoluteUrl(`/products/${slug}`) },
  ]);

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
