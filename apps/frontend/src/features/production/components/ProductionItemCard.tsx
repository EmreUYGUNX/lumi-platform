"use client";

import { useCallback, useMemo, useState } from "react";

import { Download, Eye, FileText, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ResponsiveImage } from "@/components/ui/image/ResponsiveImage";
import { cn } from "@/lib/utils";
import { CustomizationEditor } from "@/features/customization/components/editor/CustomizationEditor";
import { useProductCustomizationConfig } from "@/features/customization/hooks/useProductCustomizationConfig";
import type { Layer } from "@/features/customization/types/layer.types";
import {
  savedDesignSessionDataSchema,
  savedEditorLayersSchema,
} from "@/features/customization/types/session.types";

import { useProductionDownloadUrl } from "../hooks/useProductionDownloadUrl";
import type { ProductionOrderItem, ProductionOrderManifest } from "../types/production.types";
import { GenerateProductionButton } from "./GenerateProductionButton";

const PRINTED_STATUSES = new Set(["FULFILLED", "SHIPPED", "DELIVERED"]);

const extractEditorLayers = (designData: unknown): Layer[] | undefined => {
  const parsed = savedDesignSessionDataSchema.safeParse(designData);
  const candidate = parsed.success ? parsed.data.lumiEditor?.editorLayers : undefined;
  if (!candidate) return undefined;

  const layers = savedEditorLayersSchema.safeParse(candidate);
  if (!layers.success) return undefined;

  return layers.data as unknown as Layer[];
};

const downloadJson = (filename: string, payload: unknown) => {
  const blob = new Blob([JSON.stringify(payload, undefined, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const statusToBadge = (
  status: "pending" | "ready" | "downloaded" | "printed",
): { label: string; className: string } => {
  switch (status) {
    case "pending": {
      return {
        label: "Pending",
        className: "border-lumi-warning/30 bg-lumi-warning/10 text-lumi-warning",
      };
    }
    case "downloaded": {
      return {
        label: "Downloaded",
        className: "border-lumi-primary/30 bg-lumi-primary/10 text-lumi-primary",
      };
    }
    case "printed": {
      return {
        label: "Printed",
        className: "border-lumi-border/70 bg-lumi-bg text-lumi-text-secondary",
      };
    }
    default: {
      return {
        label: "Ready",
        className: "border-lumi-success/30 bg-lumi-success/10 text-lumi-success",
      };
    }
  }
};

const resolveProductionStatus = (params: {
  printed: boolean;
  ready: boolean;
  downloaded: boolean;
}): "pending" | "ready" | "downloaded" | "printed" => {
  if (params.printed) return "printed";
  if (!params.ready) return "pending";
  if (params.downloaded) return "downloaded";
  return "ready";
};

const resolveViewDesignMessage = (params: {
  viewerOpen: boolean;
  hasProductImage: boolean;
  hasLayers: boolean;
  templateLoading: boolean;
  hasDesignArea: boolean;
}): string | undefined => {
  if (!params.hasProductImage) return "Missing product base image.";
  if (!params.hasLayers) return "Missing saved design layers.";

  let message: string | undefined;
  if (params.viewerOpen) {
    if (params.templateLoading) {
      message = "Loading design template…";
    } else if (!params.hasDesignArea) {
      message = "Design area is not available for this product.";
    }
  }

  return message;
};

interface ProductionItemCardProps {
  item: ProductionOrderItem;
  orderId: string;
  orderReference: string;
  orderStatus: string;
  manifest: ProductionOrderManifest;
  className?: string;
}

export function ProductionItemCard({
  item,
  orderId,
  orderReference,
  orderStatus,
  manifest,
  className,
}: ProductionItemCardProps): JSX.Element {
  const download = useProductionDownloadUrl();

  const isPrinted = PRINTED_STATUSES.has(orderStatus);
  const isReady = Boolean(item.productionGenerated && item.productionPublicId);
  const isDownloaded = Boolean(item.downloadedAt);

  const status = statusToBadge(
    resolveProductionStatus({ printed: isPrinted, ready: isReady, downloaded: isDownloaded }),
  );

  const variantLabel = item.variantTitle
    ? `${item.productName} · ${item.variantTitle}`
    : item.productName;

  const [viewerOpen, setViewerOpen] = useState(false);
  const customizationConfig = useProductCustomizationConfig(item.productId, {
    enabled: viewerOpen,
  });

  const designArea = useMemo(
    () => customizationConfig.data?.designAreas.find((area) => area.name === item.designArea),
    [customizationConfig.data, item.designArea],
  );

  const layers = useMemo(() => extractEditorLayers(item.designData), [item.designData]);

  const hasLayers = Boolean(layers?.length);
  const hasProductImage = Boolean(item.productImageUrl);
  const viewButtonDisabled = !hasProductImage || !hasLayers;
  const previewSrc = item.previewUrl ?? item.thumbnailUrl ?? item.productImageUrl ?? undefined;
  const viewDesignMessage = useMemo(() => {
    return resolveViewDesignMessage({
      viewerOpen,
      hasProductImage,
      hasLayers,
      templateLoading: customizationConfig.isLoading,
      hasDesignArea: Boolean(designArea),
    });
  }, [customizationConfig.isLoading, designArea, hasLayers, hasProductImage, viewerOpen]);

  const handleDownload = useCallback(() => {
    download.mutate(item.customizationId);
  }, [download, item.customizationId]);

  const handleDownloadManifest = useCallback(() => {
    const safeReference = orderReference.replaceAll(/[^a-zA-Z0-9-_]/gu, "-");
    downloadJson(`order-${safeReference}-manifest.json`, manifest);
  }, [manifest, orderReference]);

  return (
    <Card className={cn("border-lumi-border/70 overflow-hidden", className)}>
      <CardContent className="p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          <div className="border-lumi-border/60 bg-lumi-bg-secondary/40 flex w-full flex-col overflow-hidden rounded-2xl border md:w-[220px]">
            <div className="relative aspect-[4/3] w-full">
              {previewSrc ? (
                <ResponsiveImage
                  src={previewSrc}
                  alt={`${variantLabel} preview`}
                  fill
                  className="object-cover"
                  sizes="220px"
                />
              ) : (
                <div className="text-lumi-text-secondary flex h-full w-full items-center justify-center bg-black/5 text-[11px] font-semibold uppercase tracking-[0.18em]">
                  No preview
                </div>
              )}
            </div>
            <div className="text-lumi-text-secondary flex items-center justify-between px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.22em]">
              <span>{item.designArea}</span>
              <span>{item.layerCount ?? 0} layers</span>
            </div>
          </div>

          <div className="flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold">{variantLabel}</p>
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
              <span>Qty: {item.quantity}</span>
              {item.sku ? <span>SKU: {item.sku}</span> : undefined}
              <span>Print: {item.printMethod}</span>
              <span>DPI: {item.productionDpi}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {isReady ? undefined : (
                <GenerateProductionButton orderItemId={item.orderItemId} disabled={isPrinted} />
              )}

              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-9 gap-2 text-[11px] font-semibold uppercase tracking-[0.22em]"
                onClick={handleDownload}
                disabled={!isReady || download.isPending}
              >
                {download.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Download file
              </Button>

              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-9 gap-2 text-[11px] font-semibold uppercase tracking-[0.22em]"
                onClick={() => setViewerOpen(true)}
                disabled={viewButtonDisabled}
                title={viewButtonDisabled ? viewDesignMessage : undefined}
              >
                <Eye className="h-4 w-4" />
                View design
              </Button>

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
            </div>

            {item.productionFileUrl ? (
              <p className="text-lumi-text-secondary text-xs">
                Output:{" "}
                <a
                  href={item.productionFileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-lumi-primary underline"
                >
                  {item.productionFileUrl}
                </a>
              </p>
            ) : undefined}

            {item.downloadedAt ? (
              <p className="text-lumi-text-secondary text-xs">Downloaded: {item.downloadedAt}</p>
            ) : undefined}
          </div>
        </div>
      </CardContent>

      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-[1100px] p-0">
          <div className="border-lumi-border/70 bg-lumi-bg flex flex-col gap-0 rounded-lg border">
            <DialogHeader className="border-lumi-border/70 px-6 py-4">
              <DialogTitle className="text-base font-semibold">Design viewer</DialogTitle>
              <DialogDescription>
                Order {orderReference} · Item {item.orderItemId.slice(-6)} · {item.designArea}
              </DialogDescription>
            </DialogHeader>

            <div className="h-[80vh] min-h-[540px] bg-black/5 p-4">
              {item.productImageUrl && designArea && layers && layers.length > 0 ? (
                <CustomizationEditor
                  productId={item.productId}
                  productImageUrl={item.productImageUrl}
                  designArea={designArea}
                  initialLayers={layers}
                  readOnly
                  className="h-full"
                />
              ) : (
                <div className="border-lumi-border/70 bg-lumi-bg flex h-full flex-col items-center justify-center gap-2 rounded-2xl border p-6 text-center">
                  <p className="text-sm font-semibold">Design preview unavailable</p>
                  <p className="text-lumi-text-secondary text-sm">
                    {viewDesignMessage ?? "Missing data required to render the editor."}
                  </p>
                </div>
              )}
            </div>

            <div className="border-lumi-border/70 flex items-center justify-between px-6 py-4 text-xs">
              <span className="text-lumi-text-secondary">Order ID: {orderId}</span>
              <span className="text-lumi-text-secondary">{item.printMethod}</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
