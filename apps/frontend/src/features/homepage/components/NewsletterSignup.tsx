"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { useNewsletterSignup } from "../hooks/useNewsletterSignup";

export function NewsletterSignup(): JSX.Element {
  const [email, setEmail] = useState("");
  const { isPending, mutateAsync } = useNewsletterSignup();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await mutateAsync(email);
    setEmail("");
  };

  return (
    <section className="container relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#0b1224] via-[#0c162b] to-[#0f172a] px-6 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(124,93,255,0.2),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(67,230,176,0.16),transparent_30%)]" />
      <div className="relative grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-center">
        <div className="space-y-3">
          <p className="text-lumi-text-secondary text-xs uppercase tracking-[0.3em]">Bülten</p>
          <h2 className="text-3xl font-semibold text-white">Yeni drop ve deneme.html reçeteleri</h2>
          <p className="text-sm text-white/80">
            Performans ipuçları, deney taslakları ve yeni vitrin bileşenleri direkt inbox&apos;ında.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="relative flex flex-col gap-3 sm:flex-row">
          <Input
            type="email"
            value={email}
            placeholder="ornek@lumi.com"
            onChange={(event) => setEmail(event.target.value)}
            className="bg-white/10 text-white placeholder:text-white/60"
            required
          />
          <Button
            type="submit"
            className="bg-lumi-primary hover:bg-lumi-primary-dark"
            disabled={isPending}
          >
            {isPending ? "Gönderiliyor..." : "Abone ol"}
          </Button>
        </form>
        <p className="text-xs text-white/60">
          Abone olarak gizlilik politikasını kabul edersin. Dilediğin an tek tıkla ayrılabilirsin.
        </p>
      </div>
    </section>
  );
}
