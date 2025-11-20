"use client";

import { useEffect, useTransition, type ReactNode } from "react";

import { AnimatePresence, motion } from "framer-motion";
import type { Route } from "next";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { pageTransitionVariants } from "@/animations/motion-presets";

interface PageTransitionProps {
  children: ReactNode;
  preserveScroll?: boolean;
}

interface TransitionOptions {
  scroll?: boolean;
  preserveScroll?: boolean;
}

export function useTransitionRouter(options: { preserveScroll?: boolean } = {}): {
  isTransitioning: boolean;
  push: (href: Route, opts?: TransitionOptions) => void;
  replace: (href: Route, opts?: TransitionOptions) => void;
  back: () => void;
  refresh: () => void;
  prefetch: (href: Route) => void;
} {
  const router = useRouter();
  const preserveScrollDefault = options.preserveScroll ?? false;
  const [isPending, startTransition] = useTransition();
  const isTransitioning = isPending;

  const runNavigation = (navigate: () => void, opts?: TransitionOptions): void => {
    startTransition(() => {
      navigate();
      if (!opts?.preserveScroll && !preserveScrollDefault && typeof window !== "undefined") {
        window.scrollTo({ top: 0 });
      }
    });
  };

  return {
    isTransitioning,
    push: (href, opts) =>
      runNavigation(
        () => router.push(href, { scroll: opts?.scroll ?? !preserveScrollDefault }),
        opts,
      ),
    replace: (href, opts) =>
      runNavigation(
        () => router.replace(href, { scroll: opts?.scroll ?? !preserveScrollDefault }),
        opts,
      ),
    back: () => runNavigation(() => router.back(), { preserveScroll: preserveScrollDefault }),
    refresh: () => runNavigation(() => router.refresh(), { preserveScroll: preserveScrollDefault }),
    prefetch: (href) => router.prefetch(href),
  };
}

export function PageTransition({
  children,
  preserveScroll: _preserveScroll = false,
}: PageTransitionProps): JSX.Element {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname ?? ""}?${searchParams?.toString() ?? ""}`;

  useEffect(() => {
    // On mount only; prevents hydration mismatch and ensures client can animate safely
    // (no-op body intentionally).
  }, []);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={routeKey}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={pageTransitionVariants}
        className="min-h-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
