import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function ForbiddenPage(): JSX.Element {
  return (
    <section className="bg-lumi-bg text-lumi-text mx-auto flex min-h-[70vh] max-w-5xl flex-col items-center justify-center px-6 text-center">
      <div className="border-lumi-border/60 bg-lumi-bg-secondary/60 shadow-glow max-w-2xl rounded-3xl border px-8 py-10 shadow-lg">
        <p className="text-lumi-warning text-sm font-semibold uppercase tracking-[0.3em]">403</p>
        <h1 className="mt-3 text-3xl font-semibold">Erişim yetkiniz bulunmuyor.</h1>
        <p className="text-lumi-text-secondary mt-3 text-sm leading-relaxed">
          Bu sayfa için gerekli yetkilere sahip değilsiniz. Farklı bir hesapla giriş yapabilir veya
          yardım olması için yöneticiyle iletişime geçebilirsiniz.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button asChild className="bg-lumi-primary hover:bg-lumi-primary-dark">
            <Link href="/login">Giriş yap</Link>
          </Button>
          <Button asChild variant="outline" className="border-lumi-border/60">
            <Link href="/">Ana sayfaya dön</Link>
          </Button>
        </div>
        <p className="text-lumi-text-secondary mt-4 text-xs">
          Hâlâ erişim sorunları yaşıyorsanız{" "}
          <a className="text-lumi-primary hover:underline" href="mailto:support@lumi.com">
            support@lumi.com
          </a>{" "}
          ile iletişime geçin.
        </p>
      </div>
    </section>
  );
}
