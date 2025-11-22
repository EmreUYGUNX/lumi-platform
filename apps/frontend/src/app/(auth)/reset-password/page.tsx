import { ResetPasswordForm } from "@/features/auth/components/ResetPasswordForm";

// Avoid static prerender; run at request time.
export const dynamic = "force-dynamic";
export const revalidate = 0;

interface ResetPasswordPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps): Promise<JSX.Element> {
  const resolvedParams = (await searchParams) ?? {};
  const tokenParam = resolvedParams?.token;
  const token = Array.isArray(tokenParam) ? (tokenParam[0] ?? "") : (tokenParam ?? "");

  return <ResetPasswordForm token={token} />;
}
