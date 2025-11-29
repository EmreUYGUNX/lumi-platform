"use client";

import type { UrlObject } from "node:url";

import { useMemo, useState, type FormEvent } from "react";

import { ArrowRight, Sparkles } from "lucide-react";
import type { Route } from "next";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { formatMoney } from "@/lib/formatters/price";
import { cn } from "@/lib/utils";
import { uiStore } from "@/store";

interface CartSummaryProps {
  subtotal: number;
  tax: number;
  discount?: number;
  total: number;
  currency: string;
  deliveryMessage?: string;
  compact?: boolean;
  checkoutHref?: Route | UrlObject;
  onCheckout?: () => void;
  isSubmitting?: boolean;
  showPromo?: boolean;
}

const toMoney = (amount: number, currency: string) =>
  formatMoney({ amount: amount.toFixed(2), currency });

export function CartSummary({
  subtotal,
  tax,
  discount = 0,
  total,
  currency,
  deliveryMessage,
  compact = false,
  checkoutHref = "/checkout" as Route,
  onCheckout,
  isSubmitting = false,
  showPromo = true,
}: CartSummaryProps): JSX.Element {
  const [promoCode, setPromoCode] = useState("");
  const [appliedCode, setAppliedCode] = useState<string | undefined>();
  const formatted = useMemo(
    () => ({
      subtotal: toMoney(subtotal, currency),
      tax: toMoney(tax, currency),
      discount: toMoney(Math.max(discount, 0), currency),
      total: toMoney(total, currency),
    }),
    [subtotal, tax, discount, total, currency],
  );

  const handleApply = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = promoCode.trim().toUpperCase();
    if (!code) {
      uiStore.getState().enqueueToast({
        variant: "warning",
        title: "Kupon kodu boş",
        description: "Bir indirim kodu eklemek için kod girin.",
      });
      return;
    }
    setAppliedCode(code);
    uiStore.getState().enqueueToast({
      variant: "warning",
      title: "Kupon doğrulanıyor",
      description: "İndirimler ödeme adımında doğrulanacak.",
    });
  };

  return (
    <div
      className={cn(
        "glass-panel border-lumi-border/80 space-y-4 rounded-2xl border bg-white/80 p-6 shadow-xl",
        compact && "p-5",
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-lumi-text text-sm font-semibold uppercase tracking-[0.22em]">
            Order summary
          </p>
          <p className="text-lumi-text-secondary text-[11px] uppercase tracking-[0.18em]">
            Taxes and duties at checkout
          </p>
        </div>
        <Sparkles className="text-lumi-primary h-4 w-4" />
      </div>

      {!compact && showPromo && (
        <form onSubmit={handleApply} className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={promoCode}
            onChange={(event) => setPromoCode(event.target.value)}
            placeholder="Promo code"
            className="uppercase tracking-[0.2em]"
          />
          <Button
            type="submit"
            variant="outline"
            className="border-lumi-border uppercase tracking-[0.2em]"
            disabled={isSubmitting}
          >
            Apply
          </Button>
        </form>
      )}
      {appliedCode && (
        <p className="text-lumi-text-secondary text-[11px] uppercase tracking-[0.18em]">
          Applied code <span className="text-lumi-text font-semibold">{appliedCode}</span> (awaiting
          verification)
        </p>
      )}

      <Separator className="bg-lumi-border/60" />

      <div className="space-y-3">
        <div className="flex items-center justify-between text-[12px] uppercase tracking-[0.18em]">
          <span className="text-lumi-text-secondary">Subtotal</span>
          <span className="text-lumi-text font-semibold">{formatted.subtotal}</span>
        </div>
        <div className="flex items-center justify-between text-[12px] uppercase tracking-[0.18em]">
          <span className="text-lumi-text-secondary">Shipping</span>
          <span className="text-lumi-text">Calculated at checkout</span>
        </div>
        <div className="flex items-center justify-between text-[12px] uppercase tracking-[0.18em]">
          <span className="text-lumi-text-secondary">Tax estimate</span>
          <span className="text-lumi-text">{formatted.tax}</span>
        </div>
        <div className="flex items-center justify-between text-[12px] uppercase tracking-[0.18em]">
          <span className="text-lumi-text-secondary">Discounts</span>
          <span className="text-lumi-text">{formatted.discount}</span>
        </div>
      </div>

      <Separator className="bg-lumi-border/60" />

      <div className="flex items-center justify-between">
        <span className="text-lumi-text text-sm font-semibold uppercase tracking-[0.22em]">
          Total
        </span>
        <span className="text-lumi-text text-lg font-semibold">{formatted.total}</span>
      </div>
      {deliveryMessage && (
        <p className="text-lumi-text-secondary text-[11px] uppercase tracking-[0.18em]">
          {deliveryMessage}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Button
          asChild
          disabled={isSubmitting}
          className="bg-lumi-text hover:bg-lumi-text/90 rounded-full uppercase tracking-[0.22em] text-white"
          onClick={onCheckout}
        >
          <Link href={checkoutHref ?? ("/checkout" as Route)}>
            Proceed to checkout
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
        {!compact && (
          <Button
            asChild
            variant="ghost"
            className="hover:text-lumi-text text-lumi-text-secondary uppercase tracking-[0.2em]"
          >
            <Link href="/products">Continue shopping</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
