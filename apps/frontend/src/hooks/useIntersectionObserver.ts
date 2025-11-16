"use client";

/* eslint-disable sonarjs/cognitive-complexity, unicorn/no-typeof-undefined, unicorn/no-null */
import { useCallback, useEffect, useState } from "react";

export interface UseIntersectionObserverOptions extends IntersectionObserverInit {
  /**
   * Disables the observer logic when true.
   */
  disabled?: boolean;
  /**
   * Disconnect the observer after the first intersecting entry. Defaults to true.
   */
  triggerOnce?: boolean;
}

interface IntersectionObserverState<TEntry extends HTMLElement> {
  ref: (element: TEntry | null) => void;
  isIntersecting: boolean;
}

export const useIntersectionObserver = <TElement extends HTMLElement>(
  options: UseIntersectionObserverOptions = {},
): IntersectionObserverState<TElement> => {
  const {
    disabled = false,
    triggerOnce = true,
    root: rootOption,
    rootMargin = "0px",
    threshold,
  } = options;
  const observerRoot = typeof rootOption === "undefined" ? undefined : rootOption;

  const [target, setTarget] = useState<TElement | null>(null);
  const [isIntersecting, setIntersecting] = useState(!disabled);

  const setRef = useCallback((element: TElement | null) => {
    setTarget(element);
  }, []);

  useEffect(() => {
    let observer: IntersectionObserver | undefined;

    if (disabled) {
      setIntersecting(true);
    } else if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") {
      setIntersecting(true);
    } else if (target) {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setIntersecting(true);
              if (triggerOnce) {
                observer?.disconnect();
              }
            } else if (!triggerOnce) {
              setIntersecting(false);
            }
          });
        },
        {
          root: observerRoot,
          rootMargin,
          threshold,
        },
      );

      observer.observe(target);
    } else {
      setIntersecting(false);
    }

    return () => {
      observer?.disconnect();
    };
  }, [disabled, observerRoot, target, triggerOnce, rootMargin, threshold]);

  return {
    ref: setRef,
    isIntersecting,
  };
};
