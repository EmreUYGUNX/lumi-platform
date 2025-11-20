import type { ReactNode } from "react";

import Image from "next/image";
import Link from "next/link";

import { ProfileFormExample } from "@/components/examples/forms/ProfileFormExample";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const featuredProducts = [
  {
    title: "Adaptive Storefronts",
    description: "Composable UX blocks with real-time personalization APIs.",
    metric: "↑ 38% CVR",
  },
  {
    title: "Commerce Orchestration",
    description: "Workflow engine for orders, fulfillment, and service recovery.",
    metric: "↓ 42% Ops load",
  },
  {
    title: "Customer Graph",
    description: "Unified profile with identity, preferences, and trust scoring.",
    metric: "↑ 1.8x LTV",
  },
];

const categoryHighlights = [
  {
    title: "Media & Merch",
    description: "Drop responsive lookbooks with Cloudinary pipelines and zero layout shift.",
  },
  {
    title: "Phygital Retail",
    description: "Bridge PoS, kiosks, and mobile with a single source of truth.",
  },
  {
    title: "Marketplace OS",
    description: "Multi-tenant catalog controls and settlement-ready ledgers.",
  },
];

const ctaSections = [
  {
    title: "Design a pilot in 5 days",
    body: "Our solutions architects host co-creation sprints to map your MVP, security guardrails, and KPI instrumentation.",
    action: { label: "Book a sprint", href: "/contact" },
  },
  {
    title: "Explore the Lumi Garage",
    body: "Download deneme.html assets, motion presets, and ready-to-ship UI recipes purpose-built for commerce operators.",
    action: { label: "Visit the Garage", href: "/about" },
  },
];

export default function PublicHomePage(): JSX.Element {
  return (
    <div className="space-y-16 py-12 md:py-16">
      <HeroSection />
      <Section>
        <div className="grid gap-6 md:grid-cols-3">
          {featuredProducts.map((product) => (
            <Card
              key={product.title}
              className="glass-panel border-lumi-border/60 relative overflow-hidden border"
            >
              <div className="bg-gradient-lumi absolute inset-x-0 top-0 h-px opacity-70" />
              <CardHeader>
                <CardTitle>{product.title}</CardTitle>
                <CardDescription>{product.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-lumi-primary text-sm font-semibold">{product.metric}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Category highlights">
        <div className="grid gap-8 md:grid-cols-3">
          {categoryHighlights.map((item) => (
            <div key={item.title} className="space-y-3">
              <p className="text-lumi-text-secondary text-sm uppercase tracking-[0.3em]">
                Playbook
              </p>
              <h3 className="text-xl font-semibold">{item.title}</h3>
              <p className="text-lumi-text-secondary text-sm">{item.description}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="What makes Lumi different">
        <div className="grid gap-8 md:grid-cols-2">
          {ctaSections.map((cta) => (
            <Card
              key={cta.title}
              className="bg-lumi-bg-secondary/80 border-lumi-border/70 shadow-glow border"
            >
              <CardHeader className="space-y-3">
                <CardTitle>{cta.title}</CardTitle>
                <CardDescription>{cta.body}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="bg-lumi-primary hover:bg-lumi-primary-dark">
                  <Link href={{ pathname: cta.action.href }}>{cta.action.label}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Form foundations">
        <ProfileFormExample />
      </Section>
    </div>
  );
}

function HeroSection(): JSX.Element {
  return (
    <Section className="gap-8 lg:flex lg:items-center">
      <div className="space-y-6">
        <Badge
          variant="secondary"
          className="bg-lumi-highlight text-lumi-text uppercase tracking-[0.3em]"
        >
          Phase 6
        </Badge>
        <div className="space-y-4">
          <h1 className="text-lumi-text text-4xl font-semibold leading-tight sm:text-5xl">
            Build experience-first commerce with deneme.html precision.
          </h1>
          <p className="text-lumi-text-secondary text-lg">
            Lumi pairs an expressive Next.js front layer with battle-tested backend primitives.
            Route groups frame every customer state—public, auth, dashboard, admin—so teams can ship
            without rewriting scaffolding.
          </p>
        </div>
        <div className="flex flex-wrap gap-4">
          <Button asChild className="bg-lumi-primary hover:bg-lumi-primary-dark">
            <Link href="/contact">Schedule a briefing</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/about">View platform overview</Link>
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <HeroStat value="180ms" label="App Router TTI" />
          <HeroStat value="98%" label="Lighthouse UX" />
          <HeroStat value="14 days" label="Enterprise-ready launch" />
        </div>
      </div>
      <div className="glass-panel border-lumi-border/60 relative mt-6 aspect-[4/3] overflow-hidden rounded-2xl border p-6 lg:mt-0 lg:w-1/2">
        <div className="bg-gradient-lumi absolute inset-0 opacity-30" />
        <div className="relative space-y-4">
          <p className="text-lumi-text-secondary text-sm uppercase tracking-[0.3em]">
            Experience map
          </p>
          <Image
            src="https://res.cloudinary.com/demo/image/upload/e_blur:200,q_60/v1699999999/lumi-grid.png"
            alt="Lumi experience map"
            width={640}
            height={480}
            className="rounded-xl border border-white/10 object-cover"
          />
          <Separator className="bg-white/10" />
          <p className="text-lumi-text-secondary text-sm">
            Orchestrate storefront, dashboard, and admin surfaces with shared state, design tokens,
            and compliance-ready guardrails.
          </p>
        </div>
      </div>
    </Section>
  );
}

function HeroStat({ value, label }: { value: string; label: string }): JSX.Element {
  return (
    <div className="border-lumi-border/60 bg-lumi-bg-secondary/70 rounded-2xl border p-4">
      <p className="text-lumi-primary text-2xl font-semibold">{value}</p>
      <p className="text-lumi-text-secondary text-xs uppercase tracking-[0.2em]">{label}</p>
    </div>
  );
}

function Section({
  children,
  title,
  className,
}: {
  children: ReactNode;
  title?: string;
  className?: string;
}): JSX.Element {
  return (
    <section className="container space-y-6">
      {title && (
        <div className="space-y-1">
          <p className="text-lumi-text-secondary text-sm uppercase tracking-[0.3em]">Lumi</p>
          <h2 className="text-lumi-text text-2xl font-semibold">{title}</h2>
        </div>
      )}
      <div className={className}>{children}</div>
    </section>
  );
}
