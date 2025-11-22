import { MagicLinkForm } from "@/features/auth/components/MagicLinkForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function MagicLinkPage(): JSX.Element {
  return <MagicLinkForm />;
}
