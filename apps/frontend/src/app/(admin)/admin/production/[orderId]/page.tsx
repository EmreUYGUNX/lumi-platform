"use client";

import { ArrowLeft, FileText } from "lucide-react";

import Link from "next/link";
import { useParams } from "next/navigation";

import { BatchDownloadButton } from "@/features/production/components/BatchDownloadButton";
import { ProductionItemCard } from "@/features/production/components/ProductionItemCard";
import { useProductionOrder } from "@/features/production/hooks/useProductionOrder";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const downloadJson = (filename: string, payload: unknown) => {
  const blob = new Blob([JSON.stringify(payload, undefined, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

export default function AdminProductionOrderPage(): JSX.Element {
  const params = useParams<{ orderId?: string }>();
  const orderId = typeof params?.orderId === "string" ? params.orderId : undefined;

  const orderQuery = useProductionOrder(orderId);

  if (orderQuery.isLoading) {
    return (
      <Card className="border-lumi-border/70">
        <CardContent className="p-6">
          <div className="h-7 w-2/3 animate-pulse rounded-xl bg-black/5" />
          <div className="mt-4 h-5 w-1/2 animate-pulse rounded-xl bg-black/5" />
        </CardContent>
      </Card>
    );
  }

  if (orderQuery.isError || !orderQuery.data) {
    const message =
      orderQuery.error instanceof Error ? orderQuery.error.message : "Unable to load order.";

    return (
      <Card className="border-lumi-border/70">
        <CardContent className="space-y-3 p-6">
          <p className="text-sm font-semibold">Production order unavailable</p>
          <p className="text-lumi-text-secondary text-sm">{message}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 text-[11px] font-semibold uppercase tracking-[0.22em]"
            asChild
          >
            <Link href="/admin/production">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to production
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const order = orderQuery.data;

  const handleDownloadManifest = () => {
    const safeReference = order.orderReference.replaceAll(/[^a-zA-Z0-9-_]/gu, "-");
    downloadJson(`order-${safeReference}-manifest.json`, order.manifest);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 gap-2 text-[11px] font-semibold uppercase tracking-[0.22em]"
          asChild
        >
          <Link href="/admin/production">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9 gap-2 text-[11px] font-semibold uppercase tracking-[0.22em]"
            onClick={handleDownloadManifest}
          >
            <FileText className="h-4 w-4" />
            Manifest
          </Button>
          <BatchDownloadButton orderIds={[order.orderId]} />
        </div>
      </div>

      <Card className="border-lumi-border/70">
        <CardHeader>
          <CardTitle className="flex flex-col gap-1">
            <span className="text-lumi-text-secondary text-[10px] font-semibold uppercase tracking-[0.28em]">
              Order
            </span>
            <span className="text-2xl font-semibold">{order.orderReference}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-3">
          <div className="space-y-2">
            <p className="text-lumi-text-secondary text-[10px] font-semibold uppercase tracking-[0.28em]">
              Customer
            </p>
            <p className="text-sm font-semibold">{order.customer.name}</p>
            {order.customer.email ? (
              <p className="text-lumi-text-secondary text-sm">{order.customer.email}</p>
            ) : undefined}
          </div>
          <div className="space-y-2">
            <p className="text-lumi-text-secondary text-[10px] font-semibold uppercase tracking-[0.28em]">
              Totals
            </p>
            <p className="text-sm font-semibold">
              {order.totals.totalAmount.amount} {order.totals.totalAmount.currency}
            </p>
            <p className="text-lumi-text-secondary text-sm">Status: {order.orderStatus}</p>
          </div>
          <div className="space-y-2">
            <p className="text-lumi-text-secondary text-[10px] font-semibold uppercase tracking-[0.28em]">
              Print specs
            </p>
            <p className="text-lumi-text-secondary text-sm">
              {order.printSpecs.width}×{order.printSpecs.height} @ {order.printSpecs.dpi}dpi
            </p>
            <p className="text-lumi-text-secondary text-sm">
              Bleed {order.printSpecs.bleedMm}mm · Safe {order.printSpecs.safeMm}mm
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-lumi-border/70">
        <CardHeader>
          <CardTitle>Shipping address</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {order.shippingAddress ? (
            <div className="space-y-1">
              <p className="font-semibold">{order.shippingAddress.fullName}</p>
              <p className="text-lumi-text-secondary">
                {order.shippingAddress.line1}
                {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ""}
              </p>
              <p className="text-lumi-text-secondary">
                {order.shippingAddress.postalCode} {order.shippingAddress.city}
                {order.shippingAddress.state ? `, ${order.shippingAddress.state}` : ""} ·{" "}
                {order.shippingAddress.country}
              </p>
              {order.shippingAddress.phone ? (
                <p className="text-lumi-text-secondary">{order.shippingAddress.phone}</p>
              ) : undefined}
            </div>
          ) : (
            <p className="text-lumi-text-secondary">No shipping address on record.</p>
          )}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Customized items</h2>
          <p className="text-lumi-text-secondary text-sm">{order.items.length} items</p>
        </div>

        <div className="space-y-3">
          {order.items.map((item) => (
            <ProductionItemCard
              key={item.customizationId}
              item={item}
              orderId={order.orderId}
              orderReference={order.orderReference}
              orderStatus={order.orderStatus}
              manifest={order.manifest}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
