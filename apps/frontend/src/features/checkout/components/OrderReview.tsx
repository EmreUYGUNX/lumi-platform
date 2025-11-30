"use client";

import { useMemo, useState } from "react";

import { CheckCircle2, Edit2, Lock, ShieldCheck, Truck } from "lucide-react";

import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useCart } from "@/features/cart/hooks/useCart";
import type { CartItemWithProduct } from "@/features/cart/types/cart.types";
import { buildBlurPlaceholder, buildCloudinaryUrl } from "@/lib/cloudinary";
import { formatMoney } from "@/lib/formatters/price";
import { cloudinaryImageLoader } from "@/lib/image-loader";

import { SHIPPING_METHODS, useCheckout } from "../hooks/useCheckout";
import { useCreateOrder } from "../hooks/useCreateOrder";

const fallbackImage = buildCloudinaryUrl({
  publicId: "lumi/products/board-001",
  transformations: ["c_fill,g_auto,f_auto,q_auto:eco,w_480,h_640"],
});
const blur = buildBlurPlaceholder("#0a0a0a");

const buildLineTotal = (item: CartItemWithProduct) => {
  const amount = Number.parseFloat(item.unitPrice.amount.replace(",", "."));
  return formatMoney({
    amount: (amount * item.quantity).toFixed(2),
    currency: item.unitPrice.currency,
  });
};

const resolveItemMedia = (item: CartItemWithProduct): { src: string; alt: string } => {
  // Cart payload omits media; rely on fallback visual for review step.
  return { src: fallbackImage, alt: item.product.title };
};

export function OrderReview(): JSX.Element {
  const { shippingAddress, shippingMethod, goToStep } = useCheckout();
  const cart = useCart();
  const createOrder = useCreateOrder();
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);

  const methodMeta = useMemo(
    () => SHIPPING_METHODS.find((entry) => entry.id === shippingMethod),
    [shippingMethod],
  );

  const shippingCost = methodMeta?.cost ?? 0;
  const grandTotal = cart.totals.total + shippingCost;
  const formattedTotals = {
    subtotal: formatMoney({
      amount: cart.totals.subtotal.toFixed(2),
      currency: cart.totals.currency,
    }),
    tax: formatMoney({ amount: cart.totals.tax.toFixed(2), currency: cart.totals.currency }),
    discount: formatMoney({
      amount: cart.totals.discount.toFixed(2),
      currency: cart.totals.currency,
    }),
    shipping:
      shippingCost === 0
        ? "FREE"
        : formatMoney({ amount: shippingCost.toFixed(2), currency: cart.totals.currency }),
    total: formatMoney({ amount: grandTotal.toFixed(2), currency: cart.totals.currency }),
  };

  const readyForOrder = Boolean(shippingAddress && shippingMethod && cart.items.length > 0);
  const disablePlaceOrder =
    !acceptTerms || !acceptPrivacy || !readyForOrder || createOrder.isPending;

  const renderItems = () => {
    if (cart.isLoading) {
      return (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              className="border-lumi-border/60 flex items-center gap-3 rounded-xl border bg-white/70 p-3"
            >
              <Skeleton className="h-16 w-14 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      );
    }

    if (cart.items.length === 0) {
      return (
        <div className="border-lumi-border/70 bg-lumi-bg-secondary/70 flex flex-col items-center gap-3 rounded-2xl border p-6 text-center">
          <p className="text-lumi-text text-sm font-semibold uppercase tracking-[0.22em]">
            Sepet boş
          </p>
          <p className="text-lumi-text-secondary text-[12px] uppercase tracking-[0.18em]">
            Sipariş vermek için ürün ekleyin.
          </p>
          <Button asChild variant="ghost" className="uppercase tracking-[0.2em]">
            <Link href="/products">Ürünlere dön</Link>
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {cart.items.map((item) => {
          const media = resolveItemMedia(item);
          return (
            <div
              key={item.id}
              className="border-lumi-border/60 flex items-center gap-3 rounded-xl border bg-white/80 p-3 shadow-sm"
            >
              <div className="relative h-16 w-14 overflow-hidden rounded-lg">
                <Image
                  loader={cloudinaryImageLoader}
                  src={media.src}
                  alt={media.alt}
                  fill
                  sizes="80px"
                  placeholder="blur"
                  blurDataURL={blur}
                  loading="lazy"
                  className="object-cover mix-blend-multiply"
                />
              </div>
              <div className="flex-1">
                <p className="text-lumi-text text-sm font-semibold uppercase tracking-[0.22em]">
                  {item.product.title}
                </p>
                <p className="text-lumi-text-secondary text-[11px] uppercase tracking-[0.18em]">
                  Qty {item.quantity}
                </p>
              </div>
              <div className="text-right">
                <p className="text-lumi-text text-sm font-semibold">{buildLineTotal(item)}</p>
                <p className="text-lumi-text-secondary text-[10px] uppercase tracking-[0.16em]">
                  {formatMoney(item.unitPrice)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="glass-panel border-lumi-border/60 space-y-6 rounded-2xl border bg-white/80 p-6 shadow-md backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="border-lumi-border/60 rounded-full border bg-white/70 p-3 shadow-sm">
          <ShieldCheck className="text-lumi-primary h-5 w-5" />
        </div>
        <div>
          <p className="text-lumi-text-secondary text-[10px] font-semibold uppercase tracking-[0.24em]">
            Step 3
          </p>
          <h3 className="text-lumi-text text-xl font-semibold uppercase tracking-[0.32em]">
            Order review
          </h3>
        </div>
      </div>

      <div className="space-y-4">{renderItems()}</div>

      <Separator className="bg-lumi-border/60" />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="border-lumi-border/70 rounded-2xl border p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-lumi-text text-sm font-semibold uppercase tracking-[0.22em]">
              Shipping address
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="text-lumi-text-secondary hover:text-lumi-text text-[11px] uppercase tracking-[0.18em]"
              onClick={() => goToStep("shipping")}
            >
              <Edit2 className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </div>
          {shippingAddress ? (
            <div className="text-lumi-text-secondary mt-2 space-y-1 text-[11px] uppercase tracking-[0.18em]">
              <p className="text-lumi-text font-semibold">{shippingAddress.fullName}</p>
              <p>{shippingAddress.line1}</p>
              {shippingAddress.line2 && <p>{shippingAddress.line2}</p>}
              <p>
                {shippingAddress.city}, {shippingAddress.state} {shippingAddress.postalCode}
              </p>
              <p>{shippingAddress.country}</p>
              {shippingAddress.phone && <p>{shippingAddress.phone}</p>}
              {shippingAddress.email && <p>{shippingAddress.email}</p>}
            </div>
          ) : (
            <p className="text-lumi-error text-[11px] uppercase tracking-[0.18em]">
              Teslimat bilgileri eksik.
            </p>
          )}
        </div>

        <div className="border-lumi-border/70 rounded-2xl border p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-lumi-text text-sm font-semibold uppercase tracking-[0.22em]">
              Shipping method
            </p>
            {methodMeta && (
              <span className="text-lumi-text-secondary text-[11px] uppercase tracking-[0.18em]">
                ETA {methodMeta.eta}
              </span>
            )}
          </div>
          {methodMeta ? (
            <div className="bg-lumi-background-secondary/70 mt-2 flex items-center gap-3 rounded-xl p-3">
              <Truck className="text-lumi-primary h-4 w-4" />
              <div>
                <p className="text-lumi-text text-sm font-semibold uppercase tracking-[0.22em]">
                  {methodMeta.label}
                </p>
                <p className="text-lumi-text-secondary text-[11px] uppercase tracking-[0.18em]">
                  {methodMeta.description}
                </p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-lumi-text text-sm font-semibold">
                  {methodMeta.cost === 0
                    ? "FREE"
                    : formatMoney({
                        amount: methodMeta.cost.toFixed(2),
                        currency: cart.totals.currency,
                      })}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-lumi-error text-[11px] uppercase tracking-[0.18em]">
              Kargo seçimi yapılmadı.
            </p>
          )}
        </div>
      </div>

      <div className="border-lumi-border/70 rounded-2xl border p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Lock className="text-lumi-primary h-4 w-4" />
          <p className="text-lumi-text text-sm font-semibold uppercase tracking-[0.22em]">
            Terms &amp; policies
          </p>
        </div>
        <div className="mt-3 space-y-2">
          <label className="flex items-start gap-2">
            <Checkbox
              checked={acceptTerms}
              onCheckedChange={(value) => setAcceptTerms(Boolean(value))}
              className="mt-0.5"
            />
            <span className="text-lumi-text-secondary text-[12px] uppercase tracking-[0.18em]">
              I agree to the terms &amp; conditions.
            </span>
          </label>
          <label className="flex items-start gap-2">
            <Checkbox
              checked={acceptPrivacy}
              onCheckedChange={(value) => setAcceptPrivacy(Boolean(value))}
              className="mt-0.5"
            />
            <span className="text-lumi-text-secondary text-[12px] uppercase tracking-[0.18em]">
              I agree to the privacy policy and data processing notice.
            </span>
          </label>
        </div>
      </div>

      <div className="border-lumi-border/70 bg-lumi-background-secondary/70 space-y-3 rounded-2xl border p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-lumi-text text-sm font-semibold uppercase tracking-[0.22em]">
            Order summary
          </p>
          <CheckCircle2 className="text-lumi-primary h-5 w-5" />
        </div>
        <div className="text-lumi-text-secondary space-y-2 text-[12px] uppercase tracking-[0.18em]">
          <div className="flex items-center justify-between">
            <span>Subtotal</span>
            <span className="text-lumi-text font-semibold">{formattedTotals.subtotal}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Shipping</span>
            <span className="text-lumi-text font-semibold">{formattedTotals.shipping}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Tax</span>
            <span className="text-lumi-text font-semibold">{formattedTotals.tax}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Discount</span>
            <span className="text-lumi-text font-semibold">{formattedTotals.discount}</span>
          </div>
        </div>
        <Separator className="bg-lumi-border/60" />
        <div className="flex items-center justify-between">
          <span className="text-lumi-text text-base font-semibold uppercase tracking-[0.24em]">
            Total
          </span>
          <span className="text-lumi-text text-xl font-semibold">{formattedTotals.total}</span>
        </div>
        <p className="text-lumi-text-secondary text-[11px] uppercase tracking-[0.18em]">
          Kargo ve teslimat süreleri ürün stoğuna göre değişebilir.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          className="uppercase tracking-[0.2em]"
          onClick={() => goToStep("payment")}
        >
          Back
        </Button>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            type="button"
            className="bg-lumi-text hover:bg-lumi-text/90 rounded-full px-6 uppercase tracking-[0.24em] text-white"
            disabled={disablePlaceOrder}
            onClick={() => createOrder.mutate()}
          >
            {createOrder.isPending ? (
              <>
                <ShieldCheck className="mr-2 h-4 w-4 animate-pulse" />
                Placing order...
              </>
            ) : (
              "Place order"
            )}
          </Button>
          <p className="text-lumi-text-secondary text-[11px] uppercase tracking-[0.18em]">
            Ödeme adımı Phase 10 ile tamamlanacak
          </p>
        </div>
      </div>
    </div>
  );
}
