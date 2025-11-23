"use client";

import { useEffect, useMemo, useRef } from "react";

import { motion, useMotionValue, useTransform } from "framer-motion";
import gsap from "gsap";
import type { Route } from "next";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const floatingHighlights = ["PWA-ready storefront", "Glassmorphism UI kit", "Sub-1.9s LCP targets"];

export function Hero(): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const glassRef = useRef<HTMLDivElement | null>(null);
  const motionY = useMotionValue(0);
  const parallax = useTransform(motionY, [0, 400], [0, -40]);

  useEffect(() => {
    if (!containerRef.current) {
      return () => {};
    }

    const ctx = gsap.context(() => {
      gsap.to(glassRef.current, {
        y: 12,
        rotateY: 6,
        rotateX: -6,
        repeat: -1,
        yoyo: true,
        duration: 6,
        ease: "power1.inOut",
      });
    }, containerRef);

    return () => {
      ctx.revert();
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      motionY.set(window.scrollY);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [motionY]);

  const gradientMask = useMemo(
    () => (
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0f172a] via-[#0b1021] to-[#05060d] opacity-90" />
        <motion.div
          className="bg-lumi-primary/30 absolute -left-20 -top-32 h-96 w-96 rounded-full blur-[120px]"
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 12, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -right-10 top-24 h-72 w-72 rounded-full bg-[#7c5dff]/25 blur-[120px]"
          animate={{ scale: [1, 1.12, 1], rotate: [0, 8, 0] }}
          transition={{ duration: 14, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
        />
      </div>
    ),
    [],
  );

  return (
    <section
      ref={containerRef}
      className="bg-lumi-bg relative isolate overflow-hidden px-4 pb-16 pt-20 sm:px-6 sm:pb-24 sm:pt-28 lg:px-12 lg:pb-32"
    >
      {gradientMask}
      <div className="mx-auto flex max-w-7xl flex-col items-start gap-10 lg:flex-row lg:items-center">
        <div className="relative z-10 max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-[12px] text-white/90 ring-1 ring-white/10">
            <span className="bg-lumi-primary shadow-lumi-primary h-2 w-2 rounded-full shadow-[0_0_12px]" />
            Sub-1.9s LCP hedefiyle cam dokunuşu
          </div>
          <h1 className="bg-gradient-to-br from-white via-white to-[#8fb5ff] bg-clip-text text-4xl font-bold leading-tight text-transparent md:text-5xl lg:text-6xl">
            Lumi Commerce ile deneme.html estetiğinde vitrini canlıya alın.
          </h1>
          <p className="text-lumi-text-secondary max-w-2xl text-base md:text-lg">
            Neon vurgu, cam geçişleri ve performans odaklı grid yapısı ile komple bir e-ticaret
            deneyimi. Hazır kahraman, katalog, sepet ve ödeme akışları tek bir tasarım sisteminde.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-lumi-primary hover:bg-lumi-primary-dark">
              <Link href={"/products" as Route}>Hemen İncele</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/20 bg-white/5 text-white backdrop-blur hover:border-white/40 hover:bg-white/10"
            >
              <Link href={"/about" as Route}>Deneme.html rehberi</Link>
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {floatingHighlights.map((item) => (
              <Badge
                key={item}
                variant="secondary"
                className="border-white/20 bg-white/5 text-white/80 backdrop-blur"
              >
                {item}
              </Badge>
            ))}
          </div>
        </div>

        <motion.div
          ref={glassRef}
          style={{ y: parallax }}
          className="relative z-10 w-full max-w-xl"
        >
          <Card className="glass-panel relative overflow-hidden rounded-3xl border border-white/15 bg-white/5 backdrop-blur-xl">
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-white/0 to-[#7c5dff]/10" />
            <CardContent className="relative space-y-6 p-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/70">Gerçek zamanlı stok</p>
                  <p className="text-2xl font-semibold text-white">1.280 ürün</p>
                </div>
                <div className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">
                  Headless + Next.js
                </div>
              </div>
              <div className="rounded-2xl border border-white/15 bg-black/30 p-4 shadow-inner">
                <p className="text-sm text-white/80">Canlı izleme</p>
                <div className="mt-2 flex items-end gap-1">
                  {[62, 78, 64, 92, 83, 97, 86].map((value, idx) => (
                    <motion.div
                      key={value}
                      initial={{ height: value }}
                      animate={{ height: value + 16 }}
                      transition={{
                        duration: 2.4,
                        repeat: Number.POSITIVE_INFINITY,
                        repeatType: "mirror",
                        delay: idx * 0.08,
                        ease: "easeInOut",
                      }}
                      className={cn(
                        "w-4 rounded-md bg-gradient-to-b from-[#7c5dff] to-[#43e6b0]",
                        idx === 5 ? "shadow-[0_0_20px_rgba(124,93,255,0.45)]" : "",
                      )}
                    />
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm text-white/80">
                <Stat label="LCP" value="1.8s" accent />
                <Stat label="CLS" value="0.05" />
                <Stat label="Uptime" value="99.99%" />
                <Stat label="Edge CDN" value="Aktif" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div
        className="absolute inset-x-0 bottom-8 z-10 flex justify-center"
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 2.5, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
      >
        <div className="flex h-12 w-8 items-center justify-center rounded-full border border-white/25 bg-white/5 backdrop-blur">
          <div className="h-3 w-1 rounded-full bg-white/70" />
        </div>
      </motion.div>
    </section>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur">
      <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">{label}</p>
      <p
        className={cn(
          "text-lg font-semibold text-white",
          accent && "bg-gradient-to-r from-[#7c5dff] to-[#43e6b0] bg-clip-text text-transparent",
        )}
      >
        {value}
      </p>
    </div>
  );
}
