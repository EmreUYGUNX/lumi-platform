"use client";

import { ForgotPasswordForm } from "@/features/auth/components/ForgotPasswordForm";

// Avoid static prerender; run at request time.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ForgotPasswordPage(): JSX.Element {
  return <ForgotPasswordForm />;
}
