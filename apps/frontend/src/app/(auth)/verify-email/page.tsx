import { VerifyEmailForm } from "@/features/auth/components/VerifyEmailForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function VerifyEmailPage(): JSX.Element {
  return <VerifyEmailForm />;
}
