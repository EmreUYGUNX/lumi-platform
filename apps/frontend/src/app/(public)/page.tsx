import { Suspense } from "react";

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
import { Skeleton } from "@/components/ui/skeleton";
import { generateMetadata } from "@/lib/seo/metadata";
import {
  buildBreadcrumbSchema,
  buildOrganizationSchema,
  buildWebSiteSchema,
} from "@/lib/seo/schema";
import { serializeJsonForScript } from "@/lib/serialize-json";

const homeTitle = "Lumi - Premium E-commerce Platform";
const homeDescription =
  "Lumi delivers a premium minimalist storefront with deneme.html-inspired glassmorphism, curated drops, and Cloudinary-optimized visuals for modern commerce.";
const heroOgImage = buildCloudinaryUrl({
  publicId: heroContent.backgroundId,
  transformations: ["c_fill,g_auto,f_auto,q_auto:good,w_1200,h_630"],
});

export const metadata = generateMetadata({
  title: homeTitle,
  description: homeDescription,
  path: "/",
  image: heroOgImage
    ? {
        url: heroOgImage,
        width: 1200,
        height: 630,
        alt: heroContent.title,
      }
    : undefined,
});

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    buildOrganizationSchema(heroOgImage),
    buildWebSiteSchema(),
    buildBreadcrumbSchema([{ name: "Home", url: "/" }]),
  ],
};

const JustDroppedFallback = () => (
  <section className="bg-white py-20 text-black">
    <div className="container space-y-10">
      <div className="space-y-2 text-center">
        <Skeleton className="mx-auto h-4 w-32" />
        <Skeleton className="mx-auto h-6 w-64" />
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={`just-dropped-skeleton-${index}`} className="space-y-3">
            <Skeleton className="aspect-square w-full rounded-xl" />
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default function PublicHomePage(): JSX.Element {
  return (
    <>
      <Hero {...heroContent} />
      <ExploreCollections primary={primaryCollections} secondary={secondaryCollections} />
      <CollectionsSlider items={sliderCollections} />
      <Suspense fallback={<JustDroppedFallback />}>
        <JustDropped />
      </Suspense>
      {featureBanners.map((banner) => (
        <FeatureBanner key={banner.title} {...banner} />
      ))}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonForScript(structuredData) }}
      />
    </>
  );
}
