import { CatalogPage } from "@/features/catalog/components/CatalogPage";
import { generateMetadata } from "@/lib/seo/metadata";

const title = "Lumi Catalog | Minimalist Grid";
const description =
  "Discover Lumi's curated catalog: uppercase luxury, glassmorphism accents, and Cloudinary-optimized imagery across every drop.";

export const revalidate = 60;

export const metadata = generateMetadata({
  title,
  description,
  path: "/products",
  twitterCard: "summary",
});

export default function ProductsPage(): JSX.Element {
  return <CatalogPage />;
}
