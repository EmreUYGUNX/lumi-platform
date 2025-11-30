import { WishlistPage } from "@/features/wishlist/components/WishlistPage";
import { generateMetadata } from "@/lib/seo/metadata";

const title = "Wishlist | Lumi Commerce";
const description =
  "Kaydettiğin ürünlere hızlıca geri dön, stok durumunu takip et ve tek dokunuşla sepete ekle.";

export const metadata = generateMetadata({
  title,
  description,
  path: "/wishlist",
  twitterCard: "summary",
});

export default function WishlistRoute(): JSX.Element {
  return <WishlistPage />;
}
