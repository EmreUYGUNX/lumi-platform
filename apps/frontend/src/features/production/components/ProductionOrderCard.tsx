"use client";

import { ArrowRight, Loader2, Sparkles } from "lucide-react";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

import type { ProductionOrderListItem, ProductionOrderStatus } from "../types/production.types";

const formatDate = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("tr-TR", { year: "numeric", month: "short", day: "2-digit" });
};

const formatMoney = (amount: string, currency: string): string => {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) return `${amount} ${currency}`;
  try {
    return new Intl.NumberFormat("tr-TR", { style: "currency", currency }).format(numeric);
  } catch {
    return `${amount} ${currency}`;
  }
};

const statusPresentation: Record<ProductionOrderStatus, { label: string; className: string }> = {
  pending: {
    label: "Pending",
    className: "border-lumi-warning/30 bg-lumi-warning/10 text-lumi-warning",
  },
  ready: {
    label: "Ready",
    className: "border-lumi-success/30 bg-lumi-success/10 text-lumi-success",
  },
  downloaded: {
    label: "Downloaded",
    className: "border-lumi-primary/30 bg-lumi-primary/10 text-lumi-primary",
  },
  printed: {
    label: "Printed",
    className: "border-lumi-border/70 bg-lumi-bg text-lumi-text-secondary",
  },
};

interface ProductionOrderCardProps {
  order: ProductionOrderListItem;
  selected?: boolean;
  onSelectedChange?: (orderId: string, selected: boolean) => void;
  onGenerate?: (orderId: string) => void;
  isGenerating?: boolean;
  className?: string;
}

export function ProductionOrderCard({
  order,
  selected,
  onSelectedChange,
  onGenerate,
  isGenerating,
  className,
}: ProductionOrderCardProps): JSX.Element {
  const status = statusPresentation[order.productionStatus];
  const formattedTotal = formatMoney(
    order.totals.totalAmount.amount,
    order.totals.totalAmount.currency,
  );

  const canGenerate = order.pendingCount > 0 && order.productionStatus === "pending";

  return (
    <Card className={cn("border-lumi-border/70 overflow-hidden", className)}>
      <CardContent className="p-0">
        <div className="flex flex-col gap-4 p-5 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-3">
            <Checkbox
              checked={selected}
              onCheckedChange={(value) => {
                onSelectedChange?.(order.orderId, Boolean(value));
              }}
              aria-label={`Select order ${order.orderReference}`}
              className="mt-1"
            />
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold">
                  <span className="text-lumi-text-secondary mr-2 text-[10px] font-semibold uppercase tracking-[0.28em]">
                    Order
                  </span>
                  {order.orderReference}
                </p>
                <Badge
                  className={cn(
                    "border px-2 py-0.5 text-[10px] uppercase tracking-[0.22em]",
                    status.className,
                  )}
                >
                  {status.label}
                </Badge>
              </div>
              <div className="text-lumi-text-secondary flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <span>{formatDate(order.orderDate)}</span>
                <span>{order.customer.name}</span>
                <span>{formattedTotal}</span>
              </div>
              <div className="text-lumi-text-secondary flex flex-wrap gap-3 text-[11px] uppercase tracking-[0.2em]">
                <span>{order.customizationCount} custom</span>
                <span>{order.pendingCount} pending</span>
                <span>{order.downloadedCount} downloaded</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9 gap-2 text-[11px] font-semibold uppercase tracking-[0.22em]"
              asChild
            >
              <Link href={`/admin/production/${order.orderId}`}>
                View details
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>

            {canGenerate ? (
              <Button
                type="button"
                size="sm"
                className="h-9 gap-2 text-[11px] font-semibold uppercase tracking-[0.22em]"
                disabled={!onGenerate || isGenerating}
                onClick={() => onGenerate?.(order.orderId)}
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Generate files
              </Button>
            ) : undefined}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
