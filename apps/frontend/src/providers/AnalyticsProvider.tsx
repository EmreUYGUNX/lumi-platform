"use client";

import { useEffect, useRef } from "react";

import { usePathname, useSearchParams } from "next/navigation";

import { trackPageView } from "@/lib/analytics/events";
import { addSentryBreadcrumb, setSentryTags, setSentryUser } from "@/lib/analytics/sentry";
import { sessionStore } from "@/store/session";

export function AnalyticsProvider(): JSX.Element {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastPathRef = useRef<string | null>(null);

  useEffect(() => {
    setSentryTags({ feature: "storefront" });
    setSentryUser(sessionStore.getState().user);
    const unsubscribe = sessionStore.subscribe((state) => setSentryUser(state.user));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (pathname) {
      const search = searchParams?.toString();
      const fullPath = search ? `${pathname}?${search}` : pathname;
      if (lastPathRef.current === fullPath) return;
      lastPathRef.current = fullPath;

      const title = typeof document === "undefined" ? undefined : document.title;
      trackPageView(fullPath, title);
      setSentryTags({ route: pathname });
      addSentryBreadcrumb("navigation", { pathname: fullPath }, "navigation");
    }
  }, [pathname, searchParams]);

  return <></>;
}
