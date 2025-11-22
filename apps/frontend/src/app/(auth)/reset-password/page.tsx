"use client";

import { useSearchParams } from "next/navigation";

import { ResetPasswordForm } from "@/features/auth/components/ResetPasswordForm";

// Avoid static prerender; run at request time.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ResetPasswordPage(): JSX.Element {
  const searchParams = useSearchParams();
  const token = searchParams?.get("token") ?? "";

  return <ResetPasswordForm token={token} />;
}
