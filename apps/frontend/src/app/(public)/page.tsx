import type { ReactNode } from "react";

import Link from "next/link";

import { HeroSection } from "@/components/marketing/HeroSection";
import { ImageGalleryPanel } from "@/components/performance/lazy";
import { ProfileFormExample } from "@/components/examples/forms/ProfileFormExample";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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

      <Section title="Visual performance gallery">
        <ImageGalleryPanel />
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
