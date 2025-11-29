"use client";

import { useEffect, useMemo, useState } from "react";

import { Minus, Plus, Ruler, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { uiStore } from "@/store";
import type { VariantAvailability } from "@/features/product/hooks/useVariantSelection";
import type { ProductSummary } from "@/features/products/types/product.types";
import { useAddToCart } from "@/features/cart/hooks/useAddToCart";
import { cn } from "@/lib/utils";

interface AddToCartButtonProps {
  product?: ProductSummary;
  variant?: ProductSummary["variants"][number];
  availability: VariantAvailability;
}

const MIN_QUANTITY = 1;
const MAX_QUANTITY = 10;

export function AddToCartButton({
  product,
  variant,
  availability,
}: AddToCartButtonProps): JSX.Element {
  const [quantity, setQuantity] = useState(1);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  const addToCart = useAddToCart();

  useEffect(() => {
    setQuantity(1);
  }, [variant?.id, product?.id]);

  const maxQuantity = useMemo(() => {
    if (variant?.stock !== undefined && variant.stock > 0) {
      return Math.min(MAX_QUANTITY, variant.stock);
    }
    return MAX_QUANTITY;
  }, [variant?.stock]);

  const canAdd = availability !== "out_of_stock" && Boolean(variant?.id);

  const updateQuantity = (next: number) => {
    const clamped = Math.max(MIN_QUANTITY, Math.min(maxQuantity, next));
    setQuantity(clamped);
  };

  const handleAdd = async () => {
    if (!variant?.id || !canAdd) return;
    try {
      await addToCart.mutateAsync({
        productVariantId: variant.id,
        quantity,
      });
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 1400);
    } catch (error) {
      uiStore.getState().enqueueToast({
        variant: "error",
        title: "Sepete eklenemedi",
        description:
          error instanceof Error ? error.message : "Ürün sepete eklenirken bir sorun oluştu.",
      });
    }
  };

  const lowStockMessage =
    availability === "low_stock" && variant?.stock
      ? `Only ${variant.stock} left in stock`
      : undefined;

  return (
    <div className="border-lumi-border/70 bg-lumi-bg-secondary/60 space-y-3 rounded-2xl border p-4 shadow-md backdrop-blur">
      <div className="flex items-center justify-between">
        <p className="text-lumi-text-secondary text-[11px] font-semibold uppercase tracking-[0.24em]">
          Quantity
        </p>
        <div className="border-lumi-border flex items-center rounded-full border bg-white/80 shadow-sm">
          <button
            type="button"
            onClick={() => updateQuantity(quantity - 1)}
            className="text-lumi-text px-3 py-2 disabled:opacity-50"
            disabled={quantity <= MIN_QUANTITY}
            aria-label="Decrease quantity"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="px-3 text-[11px] font-semibold uppercase tracking-[0.2em]">
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => updateQuantity(quantity + 1)}
            className="text-lumi-text px-3 py-2 disabled:opacity-50"
            disabled={quantity >= maxQuantity}
            aria-label="Increase quantity"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {lowStockMessage && (
        <p className="text-lumi-warning text-[11px] font-semibold uppercase tracking-[0.18em]">
          {lowStockMessage}
        </p>
      )}

      <Button
        size="lg"
        className={cn(
          "bg-lumi-text w-full rounded-full uppercase tracking-[0.24em] text-white transition duration-300 hover:opacity-90",
          justAdded && "bg-lumi-success",
        )}
        disabled={!canAdd || addToCart.isPending}
        onClick={handleAdd}
      >
        {addToCart.isPending ? "Adding..." : justAdded ? "Added" : "Add to Cart"}
      </Button>

      <div className="text-lumi-text-secondary flex items-center justify-between text-[11px] uppercase tracking-[0.18em]">
        <button
          type="button"
          className="hover:text-lumi-text inline-flex items-center gap-2"
          onClick={() => setSizeGuideOpen(true)}
        >
          <Ruler className="h-3.5 w-3.5" />
          Size Guide
        </button>
        <div className="inline-flex items-center gap-1">
          <Sparkles className="text-lumi-primary h-3.5 w-3.5" />
          <span>Free exchanges</span>
        </div>
      </div>

      <Dialog open={sizeGuideOpen} onOpenChange={setSizeGuideOpen}>
        <DialogContent className="border-lumi-border/70 bg-white p-6 shadow-xl sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-lumi-text text-lg font-semibold uppercase tracking-[0.2em]">
              Size Guide
            </DialogTitle>
          </DialogHeader>
          <p className="text-lumi-text-secondary text-sm">
            Measure your chest and length to find the right fit. If you are between sizes, size up
            for a relaxed silhouette.
          </p>
          <Separator className="my-3" />
          <div className="text-lumi-text grid grid-cols-3 gap-3 text-xs uppercase tracking-[0.16em]">
            <span className="font-semibold">Size</span>
            <span className="font-semibold">Chest (cm)</span>
            <span className="font-semibold">Length (cm)</span>
            <span>XS</span>
            <span>86-90</span>
            <span>64</span>
            <span>S</span>
            <span>90-95</span>
            <span>66</span>
            <span>M</span>
            <span>95-100</span>
            <span>68</span>
            <span>L</span>
            <span>100-106</span>
            <span>70</span>
            <span>XL</span>
            <span>106-112</span>
            <span>72</span>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
