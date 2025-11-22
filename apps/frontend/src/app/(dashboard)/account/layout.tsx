import { Suspense, type ReactNode } from "react";

import { PageTransition } from "@/components/layout/PageTransition";

export default function AccountLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Suspense fallback={children}>
        <PageTransition>{children}</PageTransition>
      </Suspense>
    </div>
  );
}
