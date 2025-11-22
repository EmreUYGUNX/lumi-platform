"use client";

import { LoginForm } from "@/features/auth/components/LoginForm";

// Prevent Next from attempting to prerender this client page during build.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function LoginPage(): JSX.Element {
  return <LoginForm />;
}
