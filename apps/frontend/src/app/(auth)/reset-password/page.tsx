import { ResetPasswordForm } from "@/features/auth/components/ResetPasswordForm";

// Avoid static prerender; run at request time.
export const dynamic = "force-dynamic";
export const revalidate = 0;

interface ResetPasswordPageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

export default function ResetPasswordPage({ searchParams }: ResetPasswordPageProps): JSX.Element {
  const tokenParam = searchParams?.token;
  const token = Array.isArray(tokenParam) ? (tokenParam[0] ?? "") : (tokenParam ?? "");

  return <ResetPasswordForm token={token} />;
}
