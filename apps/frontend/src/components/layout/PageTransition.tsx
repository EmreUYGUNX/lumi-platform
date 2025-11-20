"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";

import { AnimatePresence, motion } from "framer-motion";
import type { Route } from "next";

import { usePathname, useRouter } from "next/navigation";

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
  const pathname = usePathname();
  const preserveScrollDefault = options.preserveScroll ?? false;
  const [isTransitioning, setIsTransitioning] = useState(false);
  const lastScrollPosition = useRef(0);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const shouldPreserve = preserveScrollDefault || lastScrollPosition.current > 0;
    const targetScroll = shouldPreserve ? lastScrollPosition.current : 0;
    window.scrollTo({ top: targetScroll, behavior: shouldPreserve ? "auto" : "smooth" });
    setIsTransitioning(false);
  }, [pathname, preserveScrollDefault]);

  useEffect(() => {
    if (!isPending) {
      lastScrollPosition.current = 0;
    }
  }, [isPending]);

  const setScrollState = (preserveScroll?: boolean): void => {
    if (typeof window === "undefined") return;
    lastScrollPosition.current = preserveScroll ? window.scrollY : 0;
  };

  const runNavigation = (navigate: () => void, opts?: TransitionOptions): void => {
    const preserveScroll = opts?.preserveScroll ?? preserveScrollDefault;
    setScrollState(preserveScroll);
    setIsTransitioning(true);

    startTransition(() => {
      navigate();
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
  preserveScroll = false,
}: PageTransitionProps): JSX.Element {
  const pathname = usePathname();
  const [isReady, setIsReady] = useState(false);
  const scrollHandledRef = useRef(false);

  const routeKey = useMemo(() => `${pathname ?? ""}-${Date.now()}`, [pathname]);

  useEffect(() => setIsReady(true), []);

  useEffect(() => {
    if (!preserveScroll && typeof window !== "undefined" && scrollHandledRef.current) {
      window.scrollTo({ top: 0 });
    }
    scrollHandledRef.current = true;
  }, [routeKey, preserveScroll]);

  if (!isReady) {
    return <>{children}</>;
  }

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
