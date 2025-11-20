import { Suspense, type ReactNode } from "react";

import type { Route } from "next";

import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthBackground } from "@/components/auth/AuthBackground";
import { PageTransition } from "@/components/layout/PageTransition";
import { getCurrentUser, shouldEnforceGuards } from "@/lib/session";

interface AuthLayoutProps {
  children: ReactNode;
}

export default async function AuthLayout({ children }: AuthLayoutProps): Promise<JSX.Element> {
  const user = await getCurrentUser({ allowPreviewUser: false });

  if (user && shouldEnforceGuards) {
    redirect("/dashboard");
  }

  return (
    <div className="bg-lumi-bg relative min-h-screen overflow-hidden">
      <AuthBackground />
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-10">
        <Link href={"/" as Route} className="gradient-text text-2xl font-semibold">
          Lumi Commerce
        </Link>
        <div className="border-lumi-border/60 bg-lumi-bg/90 shadow-glow mt-10 w-full max-w-md rounded-3xl border p-8">
          <Suspense fallback={children}>
            <PageTransition>{children}</PageTransition>
          </Suspense>
        </div>
        <div className="text-lumi-text-secondary mt-6 flex flex-wrap items-center justify-center gap-4 text-xs">
          <Link href="/contact" className="hover:text-lumi-primary">
            Need help?
          </Link>
          <span>•</span>
          <Link href="/about" className="hover:text-lumi-primary">
            Platform overview
          </Link>
          <span>•</span>
          <a href="mailto:support@lumi.com" className="hover:text-lumi-primary">
            support@lumi.com
          </a>
        </div>
      </div>
    </div>
  );
}
