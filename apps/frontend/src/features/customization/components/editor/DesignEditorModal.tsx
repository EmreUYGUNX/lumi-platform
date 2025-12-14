"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { uiStore } from "@/store";
import { useAddToCart } from "@/features/cart/hooks/useAddToCart";
import { useUpdateCartItem } from "@/features/cart/hooks/useUpdateCartItem";

import type { Layer } from "../../types/layer.types";
import { savedDesignSessionDataSchema, savedEditorLayersSchema } from "../../types/session.types";
import type { ProductCustomizationConfig } from "../../types/product-customization.types";
import { serializePreviewLayers } from "../../hooks/usePreviewGeneration";
import { CustomizationEditor, type CustomizationEditorHandle } from "./CustomizationEditor";

const extractEditorLayers = (designData: unknown): Layer[] | undefined => {
  const parsed = savedDesignSessionDataSchema.safeParse(designData);
  const candidate = parsed.success ? parsed.data.lumiEditor?.editorLayers : undefined;
  if (!candidate) return undefined;

  const layers = savedEditorLayersSchema.safeParse(candidate);
  if (!layers.success) return undefined;

  return layers.data as unknown as Layer[];
};

const buildCartDesignData = (layers: Layer[]): Record<string, unknown> => {
  return {
    lumiEditor: {
      version: 1,
      editorLayers: layers,
      savedAt: new Date().toISOString(),
    },
  };
};

export interface DesignEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  productImageUrl: string;
  customizationConfig: ProductCustomizationConfig;
  variantId?: string;
  cartItem?: {
    id: string;
    quantity: number;
  };
  initialDesignArea?: string;
  initialDesignData?: unknown;
}

export function DesignEditorModal({
  open,
  onOpenChange,
  productId,
  productName,
  productImageUrl,
  customizationConfig,
  variantId,
  cartItem,
  initialDesignArea,
  initialDesignData,
}: DesignEditorModalProps): JSX.Element {
  const editorRef = useRef<CustomizationEditorHandle>(null);
  const addToCart = useAddToCart();
  const updateItem = useUpdateCartItem();

  const isEditing = Boolean(cartItem);
  const isSubmitting = addToCart.isPending || updateItem.isPending;

  const { designAreas } = customizationConfig;

  const resolvedInitialArea = useMemo(() => {
    const names = new Set(designAreas.map((area) => area.name));
    if (initialDesignArea && names.has(initialDesignArea)) {
      return initialDesignArea;
    }
    return designAreas[0]?.name;
  }, [designAreas, initialDesignArea]);

  const resolvedInitialLayers = useMemo(
    () => (initialDesignData ? extractEditorLayers(initialDesignData) : undefined),
    [initialDesignData],
  );

  const [designAreaName, setDesignAreaName] = useState<string | undefined>(resolvedInitialArea);
  const [areaLayers, setAreaLayers] = useState<Record<string, Layer[]>>({});

  useEffect(() => {
    if (!open) return;
    setDesignAreaName(resolvedInitialArea);
    setAreaLayers(() => {
      if (!resolvedInitialArea) return {};
      if (!resolvedInitialLayers) return {};
      return { [resolvedInitialArea]: resolvedInitialLayers };
    });
  }, [open, resolvedInitialArea, resolvedInitialLayers]);

  const activeDesignArea = useMemo(() => {
    const fallback = designAreas[0];
    if (!designAreaName) return fallback;
    return designAreas.find((area) => area.name === designAreaName) ?? fallback;
  }, [designAreaName, designAreas]);

  const handleClose = useCallback(() => {
    const dirty = editorRef.current?.isDirty() ?? false;

    if (dirty) {
      const confirmed = window.confirm(
        "You have unsaved changes. Closing will discard them. Continue?",
      );
      if (!confirmed) return;
    }

    onOpenChange(false);
  }, [onOpenChange]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        handleClose();
        return;
      }
      onOpenChange(true);
    },
    [handleClose, onOpenChange],
  );

  const handleSelectArea = useCallback(
    (next: string) => {
      if (next === designAreaName) return;
      const currentLayers = editorRef.current?.getLayers() ?? [];
      if (designAreaName) {
        setAreaLayers((previous) => ({ ...previous, [designAreaName]: currentLayers }));
      }
      setDesignAreaName(next);
    },
    [designAreaName],
  );

  const handleSave = useCallback(() => {
    editorRef.current?.requestSave();
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!activeDesignArea) return;

    const canvas = editorRef.current?.getCanvas();
    if (!canvas) {
      uiStore.getState().enqueueToast({
        variant: "warning",
        title: "Editor not ready",
        description: "Please wait for the canvas to initialize.",
      });
      return;
    }

    const previewLayers = serializePreviewLayers(canvas);
    if (previewLayers.length === 0) {
      uiStore.getState().enqueueToast({
        variant: "warning",
        title: "Add a layer",
        description: "Add at least one visible layer before adding to cart.",
      });
      return;
    }

    const editorLayers = editorRef.current?.getLayers() ?? [];

    const customization = {
      designArea: activeDesignArea.name,
      designData: buildCartDesignData(editorLayers),
      layers: previewLayers,
    };

    if (isEditing) {
      if (!cartItem) return;
      await updateItem.mutateAsync({
        itemId: cartItem.id,
        quantity: cartItem.quantity,
        customization,
      });
      onOpenChange(false);
      return;
    }

    if (!variantId) {
      uiStore.getState().enqueueToast({
        variant: "error",
        title: "Variant required",
        description: "Please select a product variant before adding to cart.",
      });
      return;
    }

    await addToCart.mutateAsync({
      productVariantId: variantId,
      quantity: 1,
      customization,
    });
    onOpenChange(false);
  }, [activeDesignArea, addToCart, cartItem, isEditing, onOpenChange, updateItem, variantId]);

  if (!activeDesignArea) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogPortal>
          <DialogOverlay />
          <DialogPrimitive.Content className="bg-lumi-bg text-lumi-text fixed inset-0 z-50 flex flex-col p-6">
            <p className="text-lumi-text-secondary text-sm">
              Customization configuration is missing for this product.
            </p>
            <Button onClick={() => onOpenChange(false)} className="mt-4 w-fit rounded-full">
              Close
            </Button>
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content className="bg-lumi-bg text-lumi-text fixed inset-0 z-50 flex h-[100dvh] w-[100dvw] flex-col overflow-hidden p-4 sm:p-6">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-lumi-text-secondary text-[10px] uppercase tracking-[0.22em]">
                Product customization
              </p>
              <h2 className="text-lumi-text line-clamp-1 text-lg font-semibold uppercase tracking-[0.22em]">
                {productName}
              </h2>
            </div>

            <div className="flex items-center gap-3">
              {designAreas.length > 1 && (
                <Select value={designAreaName} onValueChange={handleSelectArea}>
                  <SelectTrigger className="border-lumi-border/70 text-lumi-text h-11 min-w-[200px] rounded-full bg-white/80 uppercase tracking-[0.18em] shadow-sm">
                    <SelectValue placeholder="Design area" />
                  </SelectTrigger>
                  <SelectContent>
                    {designAreas.map((area) => (
                      <SelectItem key={area.name} value={area.name}>
                        {area.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-lumi-text-secondary hover:text-lumi-text rounded-full"
                onClick={handleClose}
                disabled={isSubmitting}
                aria-label="Close editor"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </header>

          <Separator className="bg-lumi-border/70 my-4" />

          <div className="min-h-0 flex-1 overflow-auto">
            <div className="h-full min-h-[720px]">
              <CustomizationEditor
                key={activeDesignArea.name}
                ref={editorRef}
                productId={productId}
                productImageUrl={productImageUrl}
                designArea={activeDesignArea}
                initialLayers={areaLayers[activeDesignArea.name]}
                className="h-full"
              />
            </div>
          </div>

          <Separator className="bg-lumi-border/70 my-4" />

          <footer className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="border-lumi-border rounded-full uppercase tracking-[0.2em]"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-lumi-border rounded-full uppercase tracking-[0.2em]"
              onClick={handleSave}
              disabled={isSubmitting}
            >
              Save design
            </Button>
            <Button
              type="button"
              className="bg-lumi-text hover:bg-lumi-text/90 rounded-full uppercase tracking-[0.22em] text-white"
              onClick={() => {
                handleSubmit().catch((error: unknown) => {
                  uiStore.getState().enqueueToast({
                    variant: "error",
                    title: "Unable to update cart",
                    description:
                      error instanceof Error ? error.message : "Unable to add design to cart.",
                  });
                });
              }}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : isEditing ? (
                "Update design"
              ) : (
                "Add to cart"
              )}
            </Button>
          </footer>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
