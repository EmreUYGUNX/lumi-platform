"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import type { CartItemWithProduct } from "../types/cart.types";
import { CartEmpty } from "./CartEmpty";
import { CartItem } from "./CartItem";
import { CartSummary } from "./CartSummary";

interface CartDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CartItemWithProduct[];
  subtotal: number;
  tax: number;
  discount?: number;
  total: number;
  currency: string;
  deliveryMessage?: string;
  isMutating?: boolean;
  onIncrement: (item: CartItemWithProduct) => void;
  onDecrement: (item: CartItemWithProduct) => void;
  onRemove: (item: CartItemWithProduct) => void;
}

export function CartDrawer({
  open,
  onOpenChange,
  items,
  subtotal,
  tax,
  discount = 0,
  total,
  currency,
  deliveryMessage,
  isMutating = false,
  onIncrement,
  onDecrement,
  onRemove,
}: CartDrawerProps): JSX.Element {
  const previewItems = items.slice(0, 5);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="border-lumi-border/60 w-full overflow-y-auto border-l sm:max-w-md"
      >
        <SheetHeader className="mb-4">
          <SheetTitle className="text-lumi-text text-sm font-semibold uppercase tracking-[0.24em]">
            Cart ({items.length})
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4">
          {previewItems.length === 0 ? (
            <CartEmpty compact />
          ) : (
            <div className={cn("space-y-3", isMutating && "opacity-80")}>
              {previewItems.map((item) => (
                <CartItem
                  key={item.id}
                  item={item}
                  compact
                  disabled={isMutating}
                  onIncrement={() => onIncrement(item)}
                  onDecrement={() => onDecrement(item)}
                  onRemove={() => onRemove(item)}
                />
              ))}
            </div>
          )}

          {previewItems.length > 0 && (
            <Button
              asChild
              variant="outline"
              className="border-lumi-border uppercase tracking-[0.2em]"
              onClick={() => onOpenChange(false)}
            >
              <Link href={{ pathname: "/cart" }}>View cart</Link>
            </Button>
          )}

          <CartSummary
            subtotal={subtotal}
            tax={tax}
            discount={discount}
            total={total}
            currency={currency}
            deliveryMessage={deliveryMessage}
            compact
            showPromo={false}
            onCheckout={() => onOpenChange(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
