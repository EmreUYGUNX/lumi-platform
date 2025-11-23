"use client";

import { useEffect, useState } from "react";

import { motion, AnimatePresence } from "framer-motion";
import { Star } from "lucide-react";

import Image from "next/image";

import { Card } from "@/components/ui/card";

import { testimonials } from "../data";

export function Testimonials(): JSX.Element {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setActive((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const safeIndex = Math.max(0, Math.min(active, testimonials.length - 1));
  const testimonial = testimonials.slice(safeIndex, safeIndex + 1)[0] ?? testimonials[0];

  if (!testimonial) return <></>;

  return (
    <section className="container space-y-6">
      <div className="space-y-2">
        <p className="text-lumi-text-secondary text-xs uppercase tracking-[0.3em]">Referanslar</p>
        <h2 className="text-3xl font-semibold">Operasyon liderlerinin yorumu</h2>
        <p className="text-lumi-text-secondary text-sm">
          Her 5 saniyede bir yeni müşteri sesi; mobilde akıcı, masaüstünde kristal.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-[1.4fr_0.8fr]">
        <AnimatePresence mode="wait">
          <motion.div
            key={testimonial.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.4 }}
          >
            <Card className="glass-panel border-lumi-border/60 shadow-glow relative overflow-hidden rounded-3xl border bg-white/5 p-8">
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-[#7c5dff]/10" />
              <div className="relative space-y-4">
                <div className="flex items-center gap-2">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Star
                      key={index}
                      className={`h-5 w-5 ${
                        testimonial.rating >= index + 1
                          ? "fill-amber-400 text-amber-400"
                          : "text-white/30"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-lg leading-relaxed text-white">{testimonial.quote}</p>
                <div className="flex items-center gap-3">
                  <div className="relative h-12 w-12 overflow-hidden rounded-full border border-white/20">
                    <Image
                      src={testimonial.avatar}
                      alt={testimonial.name}
                      fill
                      className="object-cover"
                      sizes="48px"
                    />
                  </div>
                  <div>
                    <p className="font-semibold text-white">{testimonial.name}</p>
                    <p className="text-sm text-white/70">{testimonial.role}</p>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        </AnimatePresence>

        <div className="flex flex-col gap-3">
          {testimonials.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActive(index)}
              className={`flex items-center justify-between rounded-2xl border p-4 text-left transition ${
                active === index
                  ? "border-lumi-primary/60 bg-lumi-primary/10 text-white shadow"
                  : "border-white/10 bg-white/5 text-white/80 hover:border-white/25"
              }`}
            >
              <div>
                <p className="text-sm font-semibold">{item.name}</p>
                <p className="text-xs text-white/60">{item.role}</p>
              </div>
              <span className="text-xs uppercase tracking-[0.2em]">Oku</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
