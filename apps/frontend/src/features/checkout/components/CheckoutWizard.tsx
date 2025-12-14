"use client";

/* eslint-disable import/order */

import { useEffect, useRef } from "react";

import type { Route } from "next";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { trackCheckoutStarted, trackCheckoutStep } from "@/lib/analytics/events";
import { CartSummary } from "@/features/cart/components/CartSummary";
import { useCart } from "@/features/cart/hooks/useCart";
import { Skeleton } from "@/components/ui/skeleton";

import { SHIPPING_METHODS, useCheckout } from "../hooks/useCheckout";
import { CheckoutProgress } from "./CheckoutProgress";

const StepSkeleton = () => <Skeleton className="min-h-[380px] w-full rounded-2xl" />;

const ShippingStep = dynamic(() => import("./ShippingForm").then((module) => module.ShippingForm), {
  loading: () => <StepSkeleton />,
});

const PaymentStep = dynamic(() => import("./PaymentForm").then((module) => module.PaymentForm), {
  loading: () => <StepSkeleton />,
});

const ReviewStep = dynamic(() => import("./OrderReview").then((module) => module.OrderReview), {
  loading: () => <StepSkeleton />,
});

export function CheckoutWizard(): JSX.Element {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { step, steps, progress, goToStep, canNavigateTo, goNext, shippingMethod } = useCheckout();
  const cart = useCart();
  const methodMeta = SHIPPING_METHODS.find((entry) => entry.id === shippingMethod);
  const shippingCost = methodMeta?.cost ?? 0;
  const checkoutStartedRef = useRef(false);

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

  useEffect(() => {
    if (checkoutStartedRef.current || cart.isLoading || cart.items.length === 0) return;
    trackCheckoutStarted(cart.totals.total, cart.items);
    checkoutStartedRef.current = true;
  }, [cart.isLoading, cart.items, cart.totals.total]);

  useEffect(() => {
    if (cart.isLoading || cart.items.length === 0) return;
    trackCheckoutStep(step, {
      cartValue: cart.totals.total + shippingCost,
      currency: cart.totals.currency,
      items: cart.items,
      shippingMethod,
    });
  }, [
    cart.isLoading,
    cart.items,
    cart.totals.currency,
    cart.totals.total,
    shippingCost,
    shippingMethod,
    step,
  ]);

  const renderStep = () => {
    switch (step) {
      case "shipping": {
        return <ShippingStep />;
      }
      case "payment": {
        return <PaymentStep />;
      }
      case "review": {
        return <ReviewStep />;
      }
      default: {
        return <ShippingStep />;
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
                  checkoutMode="button"
                  onCheckout={() => goNext()}
                  isSubmitting={cart.isLoading}
                  checkoutDisabled={cart.items.length === 0 || step === "review"}
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
