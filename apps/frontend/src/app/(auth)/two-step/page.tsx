import { TwoFactorForm } from "@/features/auth/components/TwoFactorForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function TwoStepPage(): JSX.Element {
  return <TwoFactorForm />;
}
