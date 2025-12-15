"use client";

import { useEffect, useMemo, useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";

import { BatchDownloadButton } from "@/features/production/components/BatchDownloadButton";
import { ProductionOrderCard } from "@/features/production/components/ProductionOrderCard";
import { ProductionPaginationControls } from "@/features/production/components/ProductionPaginationControls";
import { productionKeys } from "@/features/production/hooks/production.keys";
import { useProductionOrders } from "@/features/production/hooks/useProductionOrders";
import type { ProductionOrderStatus } from "@/features/production/types/production.types";
import {
  productionGenerateResultSchema,
  productionOrderDetailSchema,
} from "@/features/production/types/production.types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiClient } from "@/lib/api-client";
import { uiStore } from "@/store";

type StatusFilter = ProductionOrderStatus | "all";

interface BatchProgressState {
  currentOrderId?: string;
  currentOrderReference?: string;
  totalOrders: number;
  processedOrders: number;
  totalItems: number;
  processedItems: number;
}

const statusOptions: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending generation" },
  { value: "ready", label: "Production ready" },
  { value: "downloaded", label: "Downloaded" },
  { value: "printed", label: "Printed" },
];

export default function AdminProductionPage(): JSX.Element {
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<StatusFilter>("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const [searchInput, setSearchInput] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [batchProgress, setBatchProgress] = useState<BatchProgressState | undefined>();

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setSearch(searchInput.trim());
    }, 350);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [status, from, to, search, pageSize]);

  const ordersQuery = useProductionOrders({
    page,
    pageSize,
    status: status === "all" ? undefined : status,
    from: from || undefined,
    to: to || undefined,
    search: search || undefined,
  });

  const items = ordersQuery.data?.items ?? [];
  const pagination = ordersQuery.data?.pagination;

  const pageOrderIds = useMemo(() => items.map((item) => item.orderId), [items]);
  const selectedSet = useMemo(() => new Set(selectedOrderIds), [selectedOrderIds]);
  const selectedCount = selectedOrderIds.length;

  const allOnPageSelected = useMemo(() => {
    if (pageOrderIds.length === 0) return false;
    return pageOrderIds.every((id) => selectedSet.has(id));
  }, [pageOrderIds, selectedSet]);

  const toggleSelected = (orderId: string, next: boolean) => {
    setSelectedOrderIds((current) => {
      const set = new Set(current);
      if (next) {
        set.add(orderId);
      } else {
        set.delete(orderId);
      }
      return [...set];
    });
  };

  const toggleAllOnPage = (next: boolean) => {
    setSelectedOrderIds((current) => {
      const set = new Set(current);
      pageOrderIds.forEach((id) => {
        if (next) {
          set.add(id);
        } else {
          set.delete(id);
        }
      });
      return [...set];
    });
  };

  const batchGenerate = useMutation<void, Error, string[]>({
    mutationFn: async (orderIds) => {
      const unique = [...new Set(orderIds.map((id) => id.trim()).filter(Boolean))];
      if (unique.length === 0) {
        throw new Error("Select at least one order.");
      }

      setBatchProgress({
        totalOrders: unique.length,
        processedOrders: 0,
        totalItems: 0,
        processedItems: 0,
      });

      let totalItems = 0;
      let processedItems = 0;

      // eslint-disable-next-line no-restricted-syntax -- sequential generation keeps Cloudinary workload controlled.
      for (const [orderIndex, orderId] of unique.entries()) {
        setBatchProgress((current) => ({
          ...(current ?? {
            totalOrders: unique.length,
            processedOrders: 0,
            totalItems: 0,
            processedItems: 0,
          }),
          currentOrderId: orderId,
          processedOrders: orderIndex,
        }));

        // eslint-disable-next-line no-await-in-loop -- sequential fetch keeps Cloudinary workload controlled.
        const orderResponse = await apiClient.get(`/admin/production/order/${orderId}`, {
          dataSchema: productionOrderDetailSchema,
          retry: 1,
        });

        const pendingItems = orderResponse.data.items.filter(
          (item) => !item.productionGenerated || !item.productionPublicId,
        );

        const nextTotalItems = totalItems + pendingItems.length;
        totalItems = nextTotalItems;
        setBatchProgress((current) => ({
          ...(current ?? {
            totalOrders: unique.length,
            processedOrders: orderIndex,
            totalItems: 0,
            processedItems: 0,
          }),
          currentOrderReference: orderResponse.data.orderReference,
          totalItems: nextTotalItems,
        }));

        // eslint-disable-next-line no-restricted-syntax -- sequential generation keeps Cloudinary workload controlled.
        for (const item of pendingItems) {
          // eslint-disable-next-line no-await-in-loop -- sequential generation keeps Cloudinary workload controlled.
          await apiClient.post("/admin/production/generate", {
            body: { orderItemId: item.orderItemId },
            dataSchema: productionGenerateResultSchema,
          });
          processedItems += 1;
          const nextProcessedItems = processedItems;
          setBatchProgress((current) =>
            current ? { ...current, processedItems: nextProcessedItems } : current,
          );
        }

        setBatchProgress((current) =>
          current ? { ...current, processedOrders: orderIndex + 1 } : current,
        );
      }
    },
    onSuccess: () => {
      setBatchProgress(undefined);
      queryClient.invalidateQueries({ queryKey: productionKeys.all() }).catch(() => {});
      uiStore.getState().enqueueToast({
        variant: "success",
        title: "Production generation complete",
        description: "All pending production files have been generated.",
      });
    },
    onError: (error) => {
      setBatchProgress(undefined);
      uiStore.getState().enqueueToast({
        variant: "error",
        title: "Batch generation failed",
        description: error.message || "Unable to generate production files.",
      });
    },
  });

  const batchPercent = useMemo(() => {
    if (!batchProgress) return 0;
    if (batchProgress.totalItems <= 0) return 0;
    return Math.min(
      100,
      Math.round((batchProgress.processedItems / batchProgress.totalItems) * 100),
    );
  }, [batchProgress]);

  return (
    <div className="space-y-6">
      <div className="border-lumi-border/70 bg-lumi-bg shadow-glow rounded-3xl border p-6">
        <p className="text-lumi-text-secondary text-sm uppercase tracking-[0.3em]">
          Admin · Production
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Production dashboard</h1>
        <p className="text-lumi-text-secondary mt-1 text-sm">
          Track customized orders, generate production outputs, and download print-ready archives.
        </p>
      </div>

      <Card className="border-lumi-border/70">
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <p className="text-lumi-text-secondary text-[10px] font-semibold uppercase tracking-[0.28em]">
                  Status
                </p>
                <Select value={status} onValueChange={(next) => setStatus(next as StatusFilter)}>
                  <SelectTrigger className="border-lumi-border/70 h-10 bg-white/70">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <p className="text-lumi-text-secondary text-[10px] font-semibold uppercase tracking-[0.28em]">
                  From
                </p>
                <Input
                  type="date"
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                  className="border-lumi-border/70 h-10 bg-white/70"
                />
              </div>

              <div className="space-y-2">
                <p className="text-lumi-text-secondary text-[10px] font-semibold uppercase tracking-[0.28em]">
                  To
                </p>
                <Input
                  type="date"
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                  className="border-lumi-border/70 h-10 bg-white/70"
                />
              </div>

              <div className="space-y-2">
                <p className="text-lumi-text-secondary text-[10px] font-semibold uppercase tracking-[0.28em]">
                  Search
                </p>
                <Input
                  value={searchInput}
                  placeholder="Order reference"
                  onChange={(event) => setSearchInput(event.target.value)}
                  className="border-lumi-border/70 h-10 bg-white/70"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={allOnPageSelected}
                  onCheckedChange={(value) => toggleAllOnPage(Boolean(value))}
                  aria-label="Select all orders on this page"
                />
                <span className="text-lumi-text-secondary text-[11px] font-semibold uppercase tracking-[0.22em]">
                  Select page
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lumi-text-secondary text-[11px] font-semibold uppercase tracking-[0.22em]">
                  Selected: {selectedCount}
                </span>
                <Button
                  type="button"
                  size="sm"
                  className="h-9 gap-2 text-[11px] font-semibold uppercase tracking-[0.22em]"
                  disabled={selectedCount === 0 || batchGenerate.isPending}
                  onClick={() => batchGenerate.mutate(selectedOrderIds)}
                >
                  {batchGenerate.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Generate selected
                </Button>
                <BatchDownloadButton orderIds={selectedOrderIds} disabled={selectedCount === 0} />
              </div>
            </div>
          </div>

          {batchProgress ? (
            <div className="border-lumi-border/60 bg-lumi-bg-secondary/50 space-y-2 rounded-2xl border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <p className="font-semibold">
                  Generating{" "}
                  <span className="text-lumi-text-secondary">
                    {batchProgress.currentOrderReference ??
                      batchProgress.currentOrderId ??
                      "orders"}
                  </span>
                </p>
                <p className="text-lumi-text-secondary">
                  Orders {batchProgress.processedOrders}/{batchProgress.totalOrders} · Items{" "}
                  {batchProgress.processedItems}/{Math.max(1, batchProgress.totalItems)}
                </p>
              </div>
              <Progress value={batchPercent} className="h-2" />
            </div>
          ) : undefined}
        </CardContent>
      </Card>

      <div className="space-y-3">
        {ordersQuery.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Card key={index} className="border-lumi-border/70">
                <CardContent className="p-5">
                  <div className="h-6 w-2/3 animate-pulse rounded-xl bg-black/5" />
                  <div className="mt-4 h-4 w-1/2 animate-pulse rounded-xl bg-black/5" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : undefined}

        {ordersQuery.isError ? (
          <Card className="border-lumi-border/70">
            <CardContent className="space-y-3 p-6">
              <p className="text-sm font-semibold">Failed to load production orders</p>
              <p className="text-lumi-text-secondary text-sm">
                {ordersQuery.error instanceof Error ? ordersQuery.error.message : "Unknown error."}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 text-[11px] font-semibold uppercase tracking-[0.22em]"
                onClick={() => ordersQuery.refetch()}
              >
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : undefined}

        {!ordersQuery.isLoading && !ordersQuery.isError && items.length === 0 ? (
          <Card className="border-lumi-border/70">
            <CardContent className="p-6">
              <p className="text-sm font-semibold">No production orders found</p>
              <p className="text-lumi-text-secondary mt-1 text-sm">
                Adjust filters or check back once customers place customized orders.
              </p>
            </CardContent>
          </Card>
        ) : undefined}

        {items.map((order) => (
          <ProductionOrderCard
            key={order.orderId}
            order={order}
            selected={selectedSet.has(order.orderId)}
            onSelectedChange={toggleSelected}
            onGenerate={(orderId) => batchGenerate.mutate([orderId])}
            isGenerating={
              batchGenerate.isPending && batchProgress?.currentOrderId === order.orderId
            }
          />
        ))}
      </div>

      {pagination ? (
        <ProductionPaginationControls
          pagination={pagination}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      ) : undefined}
    </div>
  );
}
