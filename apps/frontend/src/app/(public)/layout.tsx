import { Suspense, type ReactNode } from "react";

import { MarketingWrapper } from "@/components/layout/MarketingWrapper";
import { NewsletterSignup } from "@/components/layout/NewsletterSignup";
import { PageTransition } from "@/components/layout/PageTransition";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";

interface PublicLayoutProps {
  children: ReactNode;
}

export default function PublicLayout({ children }: PublicLayoutProps): JSX.Element {
  return (
    <MarketingWrapper>
      <div className="bg-lumi-bg flex min-h-screen flex-col">
        <PublicHeader />
        <main className="flex-1 pt-16">
          <Suspense fallback={<div className="min-h-[160px]" />}>
            <PageTransition>{children}</PageTransition>
          </Suspense>
        </main>
        <NewsletterSignup />
        <PublicFooter />
      </div>
    </MarketingWrapper>
  );
}
