"use client";

import { useMemo, useRef } from "react";

import Image from "next/image";
import Link from "next/link";

import { animateHero, animateHotspots, useGSAP } from "@/animations/gsap";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { buildBlurPlaceholder, buildSizesAttribute } from "@/lib/cloudinary";
import { cloudinaryImageLoader } from "@/lib/image-loader";

interface Stat {
  value: string;
  label: string;
}

const heroStats: Stat[] = [
  { value: "180ms", label: "App Router TTI" },
  { value: "98%", label: "Lighthouse UX" },
  { value: "14 days", label: "Enterprise-ready launch" },
];

const hotspots = [
  {
    id: "automation",
    title: "Automation mesh",
    description: "Workflow orchestrations that coordinate media, pricing, and entitlements.",
    position: "top-[32%] left-[18%]",
  },
  {
    id: "personalization",
    title: "Personalization graph",
    description: "Behavioral insights powering deneme.html-ready storefront moments.",
    position: "top-[48%] right-[18%]",
  },
  {
    id: "operations",
    title: "Ops observability",
    description: "Live telemetry for commerce operators across dashboard and admin.",
    position: "bottom-[18%] left-1/2",
  },
];

const heroPlaceholder = buildBlurPlaceholder("#3B82F6");
const heroSizes = buildSizesAttribute("hero");
const heroImageSrc =
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME &&
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME.length > 0
    ? "lumi/experience-map"
    : "https://res.cloudinary.com/demo/image/upload/e_blur:200,q_60/v1699999999/lumi-grid.png";

export function HeroSection(): JSX.Element {
  const containerRef = useRef<HTMLElement | null>(null);
  const mediaRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const textRefs = useRef<HTMLElement[]>([]);
  const hotspotRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map());

  const setTextRef = (element: HTMLElement | null): void => {
    if (element && !textRefs.current.includes(element)) {
      textRefs.current.push(element);
    }
  };

  const setHotspotRef =
    (id: string) =>
    (element: HTMLButtonElement | null): void => {
      hotspotRefs.current.set(id, element);
    };

  useGSAP(
    (plugins) => {
      animateHero(plugins, {
        container: containerRef.current,
        media: mediaRef.current ?? undefined,
        image: imageRef.current ?? undefined,
        textBlocks: textRefs.current,
      });

      const hotspotConfigs = [...hotspotRefs.current.values()].filter(Boolean).map((hotspot) => ({
        hotspot: hotspot as HTMLButtonElement,
        pulse: hotspot?.querySelector("[data-hotspot-pulse]") as HTMLElement | null,
        tooltip: hotspot?.querySelector("[data-hotspot-tooltip]") as HTMLElement | null,
        expandTarget: hotspot?.querySelector("[data-hotspot-expand]") as HTMLElement | null,
      }));

      return animateHotspots(plugins, hotspotConfigs);
    },
    containerRef,
    [],
  );

  const statBlocks = useMemo(
    () =>
      heroStats.map((stat) => (
        <div
          key={stat.label}
          ref={setTextRef}
          className="border-lumi-border/60 bg-lumi-bg-secondary/70 rounded-2xl border p-4 shadow-sm"
        >
          <p className="text-lumi-primary text-2xl font-semibold">{stat.value}</p>
          <p className="text-lumi-text-secondary text-xs uppercase tracking-[0.2em]">
            {stat.label}
          </p>
        </div>
      )),
    [],
  );

  return (
    <section
      ref={containerRef}
      className="border-lumi-border/70 bg-lumi-bg container relative overflow-hidden rounded-[32px] border p-8 shadow-lg lg:p-12"
    >
      <div className="bg-gradient-lumi absolute inset-0 opacity-[0.08]" />
      <div className="relative grid gap-10 lg:grid-cols-[1.1fr_minmax(0,1fr)] lg:items-center">
        <div className="space-y-6">
          <div className="space-y-4" ref={setTextRef}>
            <Badge
              variant="secondary"
              className="bg-lumi-highlight text-lumi-text uppercase tracking-[0.3em]"
            >
              Phase 6
            </Badge>
            <h1 className="text-lumi-text text-4xl font-semibold leading-tight sm:text-5xl">
              Build experience-first commerce with deneme.html precision.
            </h1>
            <p className="text-lumi-text-secondary text-lg">
              Lumi pairs an expressive Next.js front layer with battle-tested backend primitives.
              Route groups frame every customer state—public, auth, dashboard, admin—so teams can
              ship without rewriting scaffolding.
            </p>
          </div>

          <div className="flex flex-wrap gap-4" ref={setTextRef}>
            <Button asChild className="bg-lumi-primary hover:bg-lumi-primary-dark">
              <Link href="/contact">Schedule a briefing</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/about">View platform overview</Link>
            </Button>
          </div>

          <div
            className="grid gap-3 sm:grid-cols-3"
            ref={setTextRef}
            aria-label="Performance metrics"
          >
            {statBlocks}
          </div>
        </div>

        <div
          ref={mediaRef}
          className="glass-panel border-lumi-border/60 bg-lumi-bg-secondary/70 shadow-glow relative overflow-hidden rounded-2xl border p-6"
          data-hotspot-expand
        >
          <div className="bg-gradient-lumi absolute inset-0 opacity-30" />
          <div className="relative space-y-4">
            <p className="text-lumi-text-secondary text-sm uppercase tracking-[0.3em]">
              Experience map
            </p>
            <div className="relative overflow-hidden rounded-2xl">
              <Image
                ref={imageRef}
                loader={cloudinaryImageLoader}
                src={heroImageSrc}
                alt="Lumi experience map"
                width={640}
                height={480}
                sizes={heroSizes}
                placeholder="blur"
                blurDataURL={heroPlaceholder}
                className="rounded-2xl border border-white/10 object-cover shadow-md"
                priority
              />
              <div className="to-lumi-primary/10 pointer-events-none absolute inset-0 bg-gradient-to-tr from-black/5 via-transparent" />
            </div>
            <Separator className="bg-white/10" />
            <p className="text-lumi-text-secondary text-sm" ref={setTextRef}>
              Orchestrate storefront, dashboard, and admin surfaces with shared state, design
              tokens, and compliance-ready guardrails.
            </p>
          </div>
          <div className="from-lumi-primary/15 via-lumi-secondary/10 to-lumi-accent/10 pointer-events-none absolute inset-4 -z-10 rounded-[24px] bg-gradient-to-br blur-2xl" />
          <div className="absolute inset-0">
            {hotspots.map((hotspot) => (
              <button
                key={hotspot.id}
                ref={setHotspotRef(hotspot.id)}
                type="button"
                className={`group absolute ${hotspot.position} -translate-x-1/2 -translate-y-1/2 rounded-full focus:outline-none`}
                aria-label={hotspot.title}
              >
                <span
                  data-hotspot-pulse
                  className="bg-lumi-primary/70 absolute inset-0 rounded-full"
                />
                <span
                  data-hotspot-expand
                  className="border-lumi-border/70 bg-lumi-background/90 relative block h-5 w-5 rounded-full border shadow"
                />
                <span
                  data-hotspot-tooltip
                  className="border-lumi-border/70 bg-lumi-bg-secondary text-lumi-text pointer-events-none absolute left-1/2 top-8 w-56 -translate-x-1/2 rounded-xl border p-3 text-left text-xs opacity-0 shadow-xl"
                >
                  <p className="text-lumi-primary font-semibold">{hotspot.title}</p>
                  <p className="text-lumi-text-secondary mt-1 leading-relaxed">
                    {hotspot.description}
                  </p>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
