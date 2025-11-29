"use client";

import { useMemo, useState } from "react";

import { Loader2, ShoppingBag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { useCart } from "../hooks/useCart";
import { useClearCart } from "../hooks/useClearCart";
import { useRemoveCartItem } from "../hooks/useRemoveCartItem";
import { useUpdateCartItem } from "../hooks/useUpdateCartItem";
import type { CartItemWithProduct } from "../types/cart.types";
import { CartDrawer } from "./CartDrawer";

const clampMiniQuantity = (item: CartItemWithProduct, next: number) => {
  const safeMax = Math.min(10, item.availableStock || 10);
  return Math.max(0, Math.min(next, safeMax));
};

export function MiniCart(): JSX.Element {
  const [open, setOpen] = useState(false);
  const cart = useCart();
  const updateItem = useUpdateCartItem();
  const removeItem = useRemoveCartItem();
  const clearCart = useClearCart();

  const isMutating = updateItem.isPending || removeItem.isPending || clearCart.isPending;

  const { items = [], itemCount = 0, totals } = cart;

  const canOpen = useMemo(() => !cart.isLoading, [cart.isLoading]);

  const handleIncrement = (item: CartItemWithProduct) => {
    const nextQty = clampMiniQuantity(item, item.quantity + 1);
    updateItem.mutate({ itemId: item.id, quantity: nextQty });
  };

  const handleDecrement = (item: CartItemWithProduct) => {
    const nextQty = clampMiniQuantity(item, item.quantity - 1);
    updateItem.mutate({ itemId: item.id, quantity: nextQty });
  };

  const handleRemove = (item: CartItemWithProduct) => {
    removeItem.mutate({ itemId: item.id });
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Open cart"
        className={cn(
          "border-lumi-border/70 relative rounded-full border bg-white/80 shadow-sm",
          open && "border-lumi-text",
        )}
        disabled={!canOpen}
        onClick={() => setOpen(true)}
      >
        {cart.isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <ShoppingBag className="h-5 w-5" />
        )}
        {itemCount > 0 && (
          <span className="bg-lumi-text absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
            {itemCount}
          </span>
        )}
      </Button>

      <CartDrawer
        open={open}
        onOpenChange={setOpen}
        items={items}
        subtotal={totals.subtotal}
        tax={totals.tax}
        discount={totals.discount}
        total={totals.total}
        currency={totals.currency}
        deliveryMessage={cart.deliveryMessage}
        isMutating={isMutating}
        onIncrement={handleIncrement}
        onDecrement={handleDecrement}
        onRemove={handleRemove}
      />
    </>
  );
}
