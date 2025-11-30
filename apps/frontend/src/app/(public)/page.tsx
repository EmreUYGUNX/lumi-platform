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
import { generateMetadata } from "@/lib/seo/metadata";
import {
  buildBreadcrumbSchema,
  buildOrganizationSchema,
  buildWebSiteSchema,
} from "@/lib/seo/schema";

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
