import { Suspense, type ReactNode } from "react";

import { MarketingWrapper } from "@/components/layout/MarketingWrapper";
import { NewsletterSignup } from "@/components/layout/NewsletterSignup";
import { PageTransition } from "@/components/layout/PageTransition";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";

interface CheckoutLayoutProps {
  children: ReactNode;
}

export default function CheckoutLayout({ children }: CheckoutLayoutProps): JSX.Element {
  return (
    <MarketingWrapper campaign="checkout">
      <div className="bg-lumi-bg flex min-h-screen flex-col">
        <PublicHeader />
        <main className="flex-1">
          <Suspense fallback={children}>
            <PageTransition>{children}</PageTransition>
          </Suspense>
        </main>
        <NewsletterSignup />
        <PublicFooter />
      </div>
    </MarketingWrapper>
  );
}
