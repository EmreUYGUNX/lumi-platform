import type { Metadata } from "next";

import { CategoryShowcase } from "@/features/homepage/components/CategoryShowcase";
import { FeaturedProducts } from "@/features/homepage/components/FeaturedProducts";
import { Hero } from "@/features/homepage/components/Hero";
import { NewsletterSignup } from "@/features/homepage/components/NewsletterSignup";
import { Testimonials } from "@/features/homepage/components/Testimonials";

const HOMEPAGE_TITLE = "Lumi - Modern E-commerce Platform";
const HOMEPAGE_DESCRIPTION =
  "Deneme.html estetiğiyle tasarlanmış, yüksek performanslı ve cam efektli Lumi vitrini. Hero, vitrin, kategori, sepet ve ödeme akışları tek yerde.";
const OG_IMAGE = "https://res.cloudinary.com/demo/image/upload/v1710500000/ecommerce/og-lumi.jpg";
const SITE_URL = "https://lumi-commerce.com";

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Lumi",
  url: SITE_URL,
  logo: "https://res.cloudinary.com/demo/image/upload/v1710500000/ecommerce/lumi-logo.png",
  sameAs: ["https://twitter.com", "https://www.linkedin.com"],
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  url: SITE_URL,
  potentialAction: {
    "@type": "SearchAction",
    target: `${SITE_URL}/search?q={query}`,
    "query-input": "required name=query",
  },
};

export const metadata: Metadata = {
  title: HOMEPAGE_TITLE,
  description: HOMEPAGE_DESCRIPTION,
  openGraph: {
    title: HOMEPAGE_TITLE,
    description: HOMEPAGE_DESCRIPTION,
    url: SITE_URL,
    siteName: "Lumi Commerce",
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "Lumi Commerce storefront",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: HOMEPAGE_TITLE,
    description: HOMEPAGE_DESCRIPTION,
    images: [OG_IMAGE],
  },
};

export default function PublicHomePage(): JSX.Element {
  return (
    <>
      <Hero />
      <FeaturedProducts />
      <CategoryShowcase />
      <NewsletterSignup />
      <Testimonials />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
    </>
  );
}
