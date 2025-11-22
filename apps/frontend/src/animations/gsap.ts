"use client";

import { useEffect, type DependencyList } from "react";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type * as ScrollSmootherModule from "gsap/ScrollSmoother";

type ScrollSmootherPlugin = typeof ScrollSmootherModule.ScrollSmoother | undefined;

let pluginsRegistered = false;
let scrollSmootherPlugin: ScrollSmootherPlugin;
let scrollSmootherLoading: Promise<ScrollSmootherPlugin> | undefined;

export interface GSAPPluginBundle {
  gsap: typeof gsap;
  ScrollTrigger?: typeof ScrollTrigger;
  ScrollSmoother?: ScrollSmootherPlugin;
}

const loadScrollSmoother = async (): Promise<ScrollSmootherPlugin> => {
  if (scrollSmootherPlugin) {
    return scrollSmootherPlugin;
  }

  if (!scrollSmootherLoading) {
    scrollSmootherLoading = import("gsap/ScrollSmoother")
      .then((smootherModule: typeof ScrollSmootherModule) => {
        const plugin: ScrollSmootherPlugin =
          smootherModule.ScrollSmoother ?? smootherModule.default ?? undefined;
        if (plugin) {
          gsap.registerPlugin(plugin);
          scrollSmootherPlugin = plugin;
        }
        return plugin;
      })
      .catch((error) => {
        if (process.env.NODE_ENV === "development") {
          // eslint-disable-next-line no-console -- surfaced only during development
          console.warn("[GSAP] ScrollSmoother unavailable; continuing without it.", error);
        }
        return scrollSmootherPlugin;
      });
  }

  return scrollSmootherLoading;
};

export const registerGSAPPlugins = (): GSAPPluginBundle => {
  if (typeof window === "undefined") {
    return { gsap };
  }

  if (!pluginsRegistered) {
    gsap.registerPlugin(ScrollTrigger);
    loadScrollSmoother().catch(() => {});

    pluginsRegistered = true;
  }

  return { gsap, ScrollTrigger, ScrollSmoother: scrollSmootherPlugin };
};

export const useGSAP = (
  effect: (plugins: GSAPPluginBundle) => void | (() => void),
  scope?: Parameters<typeof gsap.context>[1],
  deps?: DependencyList,
): void => {
  const dependencyList = deps && deps.length > 0 ? deps : [effect, scope];

  useEffect(() => {
    if (typeof window === "undefined") {
      return () => {};
    }

    const plugins = registerGSAPPlugins();
    let cleanup: void | (() => void);
    const context = gsap.context(() => {
      cleanup = effect(plugins);
    }, scope);

    return () => {
      context.revert();
      cleanup?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencyList);
};

interface HeroAnimationTargets {
  container: HTMLElement | null;
  media?: HTMLElement | null;
  image?: HTMLElement | null;
  textBlocks?: Element[];
}

export const animateHero = (plugins: GSAPPluginBundle, targets: HeroAnimationTargets): void => {
  const { gsap: gsapInstance, ScrollTrigger: ScrollTriggerInstance } = plugins;
  const { container, media, image, textBlocks } = targets;

  if (!container) return;

  const timeline = gsapInstance.timeline({ defaults: { ease: "power3.out" } });

  if (textBlocks?.length) {
    timeline.fromTo(
      textBlocks,
      { opacity: 0, y: 14 },
      {
        opacity: 1,
        y: 0,
        duration: 0.6,
        stagger: 0.08,
        delay: 0.05,
      },
      0,
    );
  }

  if (media) {
    timeline.fromTo(
      media,
      { opacity: 0, y: 22, scale: 0.97 },
      { opacity: 1, y: 0, scale: 1, duration: 0.8 },
      0.1,
    );
  }

  if (image && ScrollTriggerInstance) {
    gsapInstance.fromTo(
      image,
      { clipPath: "inset(12% 12% 12% 12% round 28px)", scale: 1.02 },
      {
        clipPath: "inset(0% 0% 0% 0% round 28px)",
        scale: 1,
        duration: 0.8,
        ease: "power2.out",
        scrollTrigger: {
          trigger: image,
          start: "top 85%",
          once: true,
        },
      },
    );

    gsapInstance.to(image, {
      yPercent: -8,
      ease: "none",
      scrollTrigger: {
        trigger: container,
        start: "top bottom",
        end: "bottom top",
        scrub: true,
      },
    });
  }
};

interface HotspotConfig {
  hotspot: HTMLElement;
  pulse?: HTMLElement | null;
  tooltip?: HTMLElement | null;
  expandTarget?: HTMLElement | null;
}

export const animateHotspots = (
  plugins: GSAPPluginBundle,
  hotspotConfigs: HotspotConfig[],
): (() => void) => {
  const { gsap: gsapInstance } = plugins;
  const cleanups: (() => void)[] = [];
  const tooltipEaseOut = "power2.out";
  const tooltipEaseInOut = "power2.inOut";

  hotspotConfigs.forEach(({ hotspot, pulse, tooltip, expandTarget }) => {
    if (pulse) {
      gsapInstance.fromTo(
        pulse,
        { scale: 0.85, opacity: 0.45 },
        { scale: 1.1, opacity: 0, duration: 1.6, repeat: -1, ease: "power1.out" },
      );
    }

    if (tooltip) {
      const showTooltip = () =>
        gsapInstance.to(tooltip, {
          autoAlpha: 1,
          y: -6,
          duration: 0.25,
          ease: tooltipEaseOut,
        });
      const hideTooltip = () =>
        gsapInstance.to(tooltip, {
          autoAlpha: 0,
          y: 0,
          duration: 0.2,
          ease: tooltipEaseInOut,
        });

      hotspot.addEventListener("mouseenter", showTooltip);
      hotspot.addEventListener("mouseleave", hideTooltip);
      hotspot.addEventListener("focus", showTooltip);
      hotspot.addEventListener("blur", hideTooltip);

      cleanups.push(() => {
        hotspot.removeEventListener("mouseenter", showTooltip);
        hotspot.removeEventListener("mouseleave", hideTooltip);
        hotspot.removeEventListener("focus", showTooltip);
        hotspot.removeEventListener("blur", hideTooltip);
      });
    }

    if (expandTarget) {
      const expand = () =>
        gsapInstance.to(expandTarget, {
          scale: 1.04,
          boxShadow: "0 20px 50px rgba(0,0,0,0.15)",
          duration: 0.3,
          ease: tooltipEaseOut,
        });
      const collapse = () =>
        gsapInstance.to(expandTarget, {
          scale: 1,
          boxShadow: "0 15px 35px rgba(0,0,0,0.12)",
          duration: 0.26,
          ease: tooltipEaseInOut,
        });

      hotspot.addEventListener("click", expand);
      hotspot.addEventListener("mouseleave", collapse);
      hotspot.addEventListener("blur", collapse);

      cleanups.push(() => {
        hotspot.removeEventListener("click", expand);
        hotspot.removeEventListener("mouseleave", collapse);
        hotspot.removeEventListener("blur", collapse);
      });
    }
  });

  return () => cleanups.forEach((cleanup) => cleanup());
};
