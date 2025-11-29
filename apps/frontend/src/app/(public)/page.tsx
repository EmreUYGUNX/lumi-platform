import type { Metadata } from "next";

import { FeatureBanner } from "@/features/homepage/components/FeatureBanner";
import { CollectionsSlider } from "@/features/homepage/components/CollectionsSlider";
import { ExploreCollections } from "@/features/homepage/components/ExploreCollections";
import { Hero } from "@/features/homepage/components/Hero";
import { JustDropped } from "@/features/homepage/components/JustDropped";
import {
  featureBanners,
  heroContent,
  primaryCollections,
  secondaryCollections,
  sliderCollections,
} from "@/features/homepage/data";
import { buildCloudinaryUrl } from "@/lib/cloudinary";

const siteUrl = "https://lumi-commerce.dev";
const homeTitle = "Lumi - Premium E-commerce Platform";
const homeDescription =
  "Lumi delivers a premium minimalist storefront with deneme.html-inspired glassmorphism, curated drops, and Cloudinary-optimized visuals for modern commerce.";
const homeOgDescription =
  "Discover the new Lumi capsule: glassmorphism, uppercase luxury typography, and Cloudinary-optimized drops built for speed.";
const homeTwitterDescription =
  "Premium minimalist commerce with curated drops, uppercase elegance, and sub-2s LCP.";
const heroOgImage = buildCloudinaryUrl({
  publicId: heroContent.backgroundId,
  transformations: ["c_fill,g_auto,f_auto,q_auto:good,w_1200,h_630"],
});

export const metadata: Metadata = {
  title: homeTitle,
  description: homeDescription,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: homeTitle,
    description: homeOgDescription,
    url: siteUrl,
    images: heroOgImage
      ? [
          {
            url: heroOgImage,
            width: 1200,
            height: 630,
            alt: heroContent.title,
          },
        ]
      : undefined,
  },
  twitter: {
    card: "summary_large_image",
    title: homeTitle,
    description: homeTwitterDescription,
    images: heroOgImage ? [heroOgImage] : undefined,
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "Lumi",
      url: siteUrl,
      logo: heroOgImage,
    },
    {
      "@type": "WebSite",
      name: "Lumi Commerce",
      url: siteUrl,
      potentialAction: {
        "@type": "SearchAction",
        target: `${siteUrl}/search?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: siteUrl,
        },
      ],
    },
  ],
};

export default function PublicHomePage(): JSX.Element {
  return (
    <>
      <Hero {...heroContent} />
      <ExploreCollections primary={primaryCollections} secondary={secondaryCollections} />
      <CollectionsSlider items={sliderCollections} />
      <JustDropped />
      {featureBanners.map((banner) => (
        <FeatureBanner key={banner.title} {...banner} />
      ))}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
    </>
  );
}
