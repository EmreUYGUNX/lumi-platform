"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

import Lenis from "@studio-freight/lenis";

interface LenisProviderProps {
  children: ReactNode;
}

export function LenisProvider({ children }: LenisProviderProps): JSX.Element {
  const lenisRef = useRef<Lenis | undefined>();

  useEffect(() => {
    if (typeof window === "undefined") {
      return () => {};
    }

    const lenis = new Lenis({
      duration: 1.25,
      gestureOrientation: "vertical",
      smoothWheel: true,
      lerp: 0.08,
    });

    lenisRef.current = lenis;

    let animationFrame = 0;
    const onFrame = (time: number) => {
      lenis.raf(time);
      animationFrame = requestAnimationFrame(onFrame);
    };

    animationFrame = requestAnimationFrame(onFrame);

    return () => {
      cancelAnimationFrame(animationFrame);
      lenis.destroy();
      lenisRef.current = undefined;
    };
  }, []);

  return <>{children}</>;
}
