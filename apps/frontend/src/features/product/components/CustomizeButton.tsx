"use client";

import { useMemo, useState } from "react";

import { Loader2, Palette } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DesignEditorModal } from "@/features/customization/components/editor/DesignEditorModal";
import { useProductCustomizationConfig } from "@/features/customization/hooks/useProductCustomizationConfig";
import type { ProductCustomizationConfig } from "@/features/customization/types/product-customization.types";
import type { VariantAvailability } from "@/features/product/hooks/useVariantSelection";
import { uiStore } from "@/store";

export interface CustomizeButtonProps {
  productId: string;
  productName: string;
  productImage: string;
  customizationConfig?: ProductCustomizationConfig;
  variantId?: string;
  availability?: VariantAvailability;
}

export function CustomizeButton({
  productId,
  productName,
  productImage,
  customizationConfig,
  variantId,
  availability,
}: CustomizeButtonProps): JSX.Element {
  const [open, setOpen] = useState(false);

  const configQuery = useProductCustomizationConfig(productId, {
    enabled: customizationConfig === undefined,
  });

  const config = customizationConfig ?? configQuery.data;

  const customizationEnabled = useMemo(() => Boolean(config?.enabled), [config?.enabled]);

  const disabled =
    availability === "out_of_stock" || configQuery.isLoading || !customizationEnabled;

  return (
    <>
      <Button
        size="lg"
        className="bg-lumi-text hover:bg-lumi-text/90 flex w-full items-center justify-center gap-2 rounded-full uppercase tracking-[0.24em] text-white"
        disabled={disabled}
        onClick={() => {
          if (!customizationEnabled || !config) {
            uiStore.getState().enqueueToast({
              variant: "warning",
              title: "Customization unavailable",
              description: "This product does not support customization yet.",
            });
            return;
          }
          setOpen(true);
        }}
      >
        {configQuery.isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </>
        ) : (
          <>
            <Palette className="h-4 w-4" />
            Customize
          </>
        )}
      </Button>

      {config && customizationEnabled && (
        <DesignEditorModal
          open={open}
          onOpenChange={setOpen}
          productId={productId}
          productName={productName}
          productImageUrl={productImage}
          customizationConfig={config}
          variantId={variantId}
        />
      )}
    </>
  );
}
