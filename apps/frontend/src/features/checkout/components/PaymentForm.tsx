"use client";

import { CreditCard, Loader2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

import { useCheckout } from "../hooks/useCheckout";

export function PaymentForm(): JSX.Element {
  const { setPaymentMethod, goToStep, goPrev } = useCheckout();

  const handleContinue = () => {
    setPaymentMethod("placeholder");
    goToStep("review");
  };

  return (
    <div className="glass-panel border-lumi-border/60 space-y-6 rounded-2xl border bg-white/80 p-6 shadow-md backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="border-lumi-border/60 rounded-full border bg-white/70 p-3 shadow-sm">
          <CreditCard className="text-lumi-primary h-5 w-5" />
        </div>
        <div>
          <p className="text-lumi-text-secondary text-[10px] font-semibold uppercase tracking-[0.24em]">
            Step 2
          </p>
          <h3 className="text-lumi-text text-xl font-semibold uppercase tracking-[0.32em]">
            Payment (placeholder)
          </h3>
        </div>
      </div>

      <div className="bg-lumi-background-secondary/80 border-lumi-border/60 flex flex-col gap-3 rounded-2xl border p-5 shadow-inner">
        <div className="flex items-center gap-2">
          <ShieldCheck className="text-lumi-primary h-5 w-5" />
          <p className="text-lumi-text text-sm font-semibold uppercase tracking-[0.22em]">
            Coming soon
          </p>
        </div>
        <p className="text-lumi-text-secondary text-sm leading-relaxed">
          Payment integration coming soon. Bu adımda henüz kart bilgisi alınmıyor. Ödeme akışı Phase
          10&apos;da entegre edilecek. Devam ederek sipariş özetine ilerleyebilirsiniz.
        </p>
        <div className="flex items-center gap-3 rounded-xl bg-white/70 px-4 py-3">
          <Loader2 className="text-lumi-text h-4 w-4 animate-spin" />
          <p className="text-lumi-text text-[11px] uppercase tracking-[0.2em]">
            Güvenli ödeme altyapısı hazırlanıyor
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            className="uppercase tracking-[0.2em]"
            onClick={() => goPrev()}
          >
            Back
          </Button>
          <Button
            type="button"
            className="bg-lumi-text hover:bg-lumi-text/90 rounded-full px-6 uppercase tracking-[0.24em] text-white"
            onClick={handleContinue}
          >
            Continue to review
          </Button>
        </div>
        <p className="text-lumi-text-secondary text-[11px] uppercase tracking-[0.18em]">
          3D Secure &amp; Iyzico Phase 10
        </p>
      </div>
    </div>
  );
}
