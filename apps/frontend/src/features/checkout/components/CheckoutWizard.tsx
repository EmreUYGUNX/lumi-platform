"use client";

import { useEffect } from "react";

import { Loader2 } from "lucide-react";
import type { Route } from "next";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { CartSummary } from "@/features/cart/components/CartSummary";
import { useCart } from "@/features/cart/hooks/useCart";

import { SHIPPING_METHODS, useCheckout } from "../hooks/useCheckout";
import { CheckoutProgress } from "./CheckoutProgress";
import { OrderReview } from "./OrderReview";
import { PaymentForm } from "./PaymentForm";
import { ShippingForm } from "./ShippingForm";

export function CheckoutWizard(): JSX.Element {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { step, steps, progress, goToStep, canNavigateTo, goNext, shippingMethod } = useCheckout();
  const cart = useCart();
  const methodMeta = SHIPPING_METHODS.find((entry) => entry.id === shippingMethod);
  const shippingCost = methodMeta?.cost ?? 0;

  const urlStep = searchParams?.get("step");
  useEffect(() => {
    if (!urlStep) return;
    if (steps.includes(urlStep as typeof step) && urlStep !== step) {
      goToStep(urlStep as typeof step);
    }
  }, [urlStep, goToStep, step, steps]);

  useEffect(() => {
    if (!pathname) return;
    const params = new URLSearchParams(searchParams?.toString());
    params.set("step", step);
    router.replace(`${pathname}?${params.toString()}` as Route, { scroll: false });
  }, [pathname, router, searchParams, step]);

  const renderStep = () => {
    switch (step) {
      case "shipping": {
        return <ShippingForm />;
      }
      case "payment": {
        return <PaymentForm />;
      }
      case "review": {
        return <OrderReview />;
      }
      default: {
        return <ShippingForm />;
      }
    }
  };

  return (
    <div className="bg-lumi-bg text-lumi-text">
      <div className="container mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6">
          <p className="text-lumi-text-secondary text-[10px] uppercase tracking-[0.2em]">
            Home / Checkout
          </p>
          <h1 className="text-3xl font-semibold uppercase tracking-[0.32em]">Checkout wizard</h1>
        </div>

        <div className="space-y-6">
          <CheckoutProgress
            step={step}
            steps={steps}
            progress={progress}
            onStepChange={(target) => goToStep(target)}
            canNavigateTo={canNavigateTo}
          />

          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.6fr]">
            <div className="space-y-4">{renderStep()}</div>
            <div className="lg:sticky lg:top-24">
              {cart.isLoading ? (
                <div className="border-lumi-border/60 flex items-center gap-2 rounded-2xl border bg-white/80 p-4 shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <p className="text-lumi-text-secondary text-sm">Sepet yükleniyor...</p>
                </div>
              ) : (
                <CartSummary
                  subtotal={cart.totals.subtotal}
                  tax={cart.totals.tax}
                  discount={cart.totals.discount}
                  total={cart.totals.total + shippingCost}
                  currency={cart.totals.currency}
                  deliveryMessage={cart.deliveryMessage ?? methodMeta?.description}
                  compact
                  checkoutHref={"/checkout" as Route}
                  onCheckout={() => goNext()}
                  isSubmitting={false}
                  showPromo={false}
                  checkoutLabel={step === "review" ? "Place order" : "Continue"}
                />
              )}
              {!cart.isLoading && cart.items.length === 0 && (
                <p className="text-lumi-error mt-2 text-[11px] uppercase tracking-[0.18em]">
                  Sepet boş. Sipariş için ürün ekleyin.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
