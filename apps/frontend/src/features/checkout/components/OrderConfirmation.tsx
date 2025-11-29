"use client";

import { useMemo } from "react";

import { ArrowRight, CheckCircle2, Printer, Truck } from "lucide-react";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatMoney } from "@/lib/formatters/price";

import { SHIPPING_METHODS, useCheckout } from "../hooks/useCheckout";

const formatDate = (value?: string): string | undefined => {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export function OrderConfirmation(): JSX.Element {
  const { lastOrder } = useCheckout();

  const estimatedDelivery = formatDate(lastOrder?.estimatedDelivery);
  const shippingMeta = useMemo(
    () => SHIPPING_METHODS.find((entry) => entry.id === lastOrder?.shippingMethod),
    [lastOrder?.shippingMethod],
  );

  if (!lastOrder) {
    return (
      <div className="glass-panel border-lumi-border/60 space-y-4 rounded-2xl border bg-white/80 p-6 text-center shadow-md backdrop-blur">
        <p className="text-lumi-text text-xl font-semibold uppercase tracking-[0.32em]">
          Order confirmation
        </p>
        <p className="text-lumi-text-secondary text-sm">
          Sipariş bilgisi bulunamadı. Lütfen sepetten yeni bir sipariş oluşturun.
        </p>
        <div className="flex justify-center gap-3">
          <Button asChild variant="outline" className="uppercase tracking-[0.2em]">
            <Link href="/products">Ürünlere dön</Link>
          </Button>
          <Button
            asChild
            className="bg-lumi-text hover:bg-lumi-text/90 uppercase tracking-[0.22em] text-white"
          >
            <Link href="/cart">Sepete git</Link>
          </Button>
        </div>
      </div>
    );
  }

  const total = formatMoney(lastOrder.total);

  return (
    <div className="glass-panel border-lumi-border/60 space-y-6 rounded-2xl border bg-white/80 p-6 shadow-md backdrop-blur">
      <div className="flex items-center gap-4">
        <div className="border-lumi-primary/40 bg-lumi-primary/10 flex h-16 w-16 items-center justify-center rounded-full border">
          <CheckCircle2 className="text-lumi-primary h-8 w-8 animate-pulse" />
        </div>
        <div>
          <p className="text-lumi-text-secondary text-[11px] uppercase tracking-[0.2em]">
            Order received
          </p>
          <h1 className="text-lumi-text text-2xl font-semibold uppercase tracking-[0.32em]">
            Thank you for your order
          </h1>
          <p className="text-lumi-text-secondary text-sm">
            Order #{lastOrder.reference ?? lastOrder.id} • {total}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="border-lumi-border/70 rounded-2xl border p-4 shadow-sm">
          <p className="text-lumi-text text-sm font-semibold uppercase tracking-[0.22em]">
            Order summary
          </p>
          <div className="text-lumi-text-secondary mt-3 space-y-2 text-[11px] uppercase tracking-[0.18em]">
            {lastOrder.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between">
                <span>
                  {item.title} • {item.quantity}x
                </span>
                <span className="text-lumi-text font-semibold">{formatMoney(item.unitPrice)}</span>
              </div>
            ))}
          </div>
          <Separator className="bg-lumi-border/60 my-3" />
          <div className="flex items-center justify-between">
            <span className="text-lumi-text text-base font-semibold uppercase tracking-[0.22em]">
              Total
            </span>
            <span className="text-lumi-text text-lg font-semibold">{total}</span>
          </div>
        </div>

        <div className="border-lumi-border/70 rounded-2xl border p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Truck className="text-lumi-primary h-4 w-4" />
            <p className="text-lumi-text text-sm font-semibold uppercase tracking-[0.22em]">
              Delivery
            </p>
          </div>
          <p className="text-lumi-text-secondary mt-2 text-[11px] uppercase tracking-[0.18em]">
            {shippingMeta ? `${shippingMeta.label} • ${shippingMeta.eta}` : "Standard delivery"}
          </p>
          {estimatedDelivery && (
            <p className="text-lumi-text text-sm font-semibold uppercase tracking-[0.22em]">
              Estimated: {estimatedDelivery}
            </p>
          )}
          <p className="text-lumi-text-secondary text-sm">
            Teslimat detayları e-posta ile paylaşılacak. Kargonuz yola çıktığında bildirim
            alacaksınız.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild variant="outline" className="uppercase tracking-[0.2em]">
              <Link href="/dashboard/orders">
                Track order
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="uppercase tracking-[0.2em]"
              onClick={() => window.print()}
            >
              <Printer className="mr-2 h-4 w-4" />
              Print receipt
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          asChild
          className="bg-lumi-text hover:bg-lumi-text/90 rounded-full px-6 uppercase tracking-[0.24em] text-white"
        >
          <Link href="/products">Continue shopping</Link>
        </Button>
        <Button asChild variant="ghost" className="uppercase tracking-[0.2em]">
          <Link href="/cart">View cart</Link>
        </Button>
      </div>
    </div>
  );
}
