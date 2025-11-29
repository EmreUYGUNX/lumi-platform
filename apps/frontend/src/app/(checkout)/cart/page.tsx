"use client";

import { AlertCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { CartEmpty } from "@/features/cart/components/CartEmpty";
import { CartItem } from "@/features/cart/components/CartItem";
import { CartSummary } from "@/features/cart/components/CartSummary";
import { useCart } from "@/features/cart/hooks/useCart";
import { useClearCart } from "@/features/cart/hooks/useClearCart";
import { useRemoveCartItem } from "@/features/cart/hooks/useRemoveCartItem";
import { useUpdateCartItem } from "@/features/cart/hooks/useUpdateCartItem";
import type { CartItemWithProduct, CartStockIssue } from "@/features/cart/types/cart.types";
import { cn } from "@/lib/utils";
import { uiStore } from "@/store";

const clampQuantity = (item: CartItemWithProduct, next: number) => {
  const safeMax = Math.min(10, item.availableStock || 10);
  return Math.max(0, Math.min(next, safeMax));
};

const CartSkeleton = () => (
  <div className="space-y-4">
    {Array.from({ length: 3 }).map((_, index) => (
      <div
        // eslint-disable-next-line react/no-array-index-key
        key={index}
        className="glass-panel border-lumi-border/60 flex gap-4 rounded-2xl border bg-white/70 p-4"
      >
        <Skeleton className="h-24 w-20 rounded-xl" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    ))}
  </div>
);

const StockAlerts = ({ issues }: { issues: CartStockIssue[] }) => {
  if (issues.length === 0) return <></>;
  return (
    <div className="border-lumi-warning/60 bg-lumi-warning/10 text-lumi-warning rounded-2xl border p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em]">Stock warnings</p>
      </div>
      <ul className="mt-2 space-y-1 text-[11px] uppercase tracking-[0.16em]">
        {issues.map((issue) => (
          <li key={`${issue.itemId}-${issue.type}`} className="text-lumi-text">
            {issue.message}
          </li>
        ))}
      </ul>
    </div>
  );
};

const notifyWishlist = (item: CartItemWithProduct) => {
  uiStore.getState().enqueueToast({
    variant: "warning",
    title: "Wishlist yakında",
    description: `${item.product.title} favorilere yakında eklenebilecek.`,
  });
};

export default function CartPage(): JSX.Element {
  const cart = useCart();
  const updateItem = useUpdateCartItem();
  const removeItem = useRemoveCartItem();
  const clearCart = useClearCart();

  const items = cart.items ?? [];
  const { totals } = cart;
  const isMutating = updateItem.isPending || removeItem.isPending || clearCart.isPending;

  const handleDecrement = (item: CartItemWithProduct) => {
    const nextQty = clampQuantity(item, item.quantity - 1);
    if (nextQty <= 0) {
      removeItem.mutate({ itemId: item.id });
      return;
    }
    updateItem.mutate({ itemId: item.id, quantity: nextQty });
  };

  const handleIncrement = (item: CartItemWithProduct) => {
    const nextQty = clampQuantity(item, item.quantity + 1);
    updateItem.mutate({ itemId: item.id, quantity: nextQty });
  };

  const handleRemove = (item: CartItemWithProduct) => {
    removeItem.mutate({ itemId: item.id });
  };

  const emptyState = cart.isLoading ? <CartSkeleton /> : <CartEmpty className="mt-4" />;

  const content = cart.isError ? (
    <div className="border-lumi-error/50 bg-lumi-error/10 text-lumi-error rounded-2xl border p-4">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-5 w-5" />
        <p className="text-sm font-semibold uppercase tracking-[0.2em]">Cart unavailable</p>
      </div>
      <p className="text-lumi-text mt-2 text-sm">
        Sepet bilgileri alınamadı. Lütfen bağlantınızı kontrol edin ve tekrar deneyin.
      </p>
    </div>
  ) : items.length === 0 ? (
    emptyState
  ) : (
    <div className="space-y-4">
      {items.map((item) => (
        <CartItem
          key={item.id}
          item={item}
          disabled={isMutating}
          onDecrement={() => handleDecrement(item)}
          onIncrement={() => handleIncrement(item)}
          onRemove={() => handleRemove(item)}
          onMoveToWishlist={() => notifyWishlist(item)}
        />
      ))}
    </div>
  );

  return (
    <div className="bg-lumi-bg text-lumi-text">
      <div className="container mx-auto max-w-6xl px-4 py-10">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lumi-text-secondary text-[10px] uppercase tracking-[0.18em]">
              Home / Cart
            </p>
            <h1 className="text-2xl font-semibold uppercase tracking-[0.26em]">Shopping Cart</h1>
          </div>
          {items.length > 0 && (
            <Button
              variant="ghost"
              className="hover:text-lumi-text text-lumi-text-secondary uppercase tracking-[0.18em]"
              onClick={() => clearCart.mutate()}
              disabled={clearCart.isPending}
            >
              {clearCart.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Clear cart
            </Button>
          )}
        </div>

        <Separator className="bg-lumi-border/70 my-6" />

        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.45fr]">
          <div className="space-y-4">
            <StockAlerts issues={cart.stockIssues ?? []} />
            {content}
          </div>
          <div className={cn("lg:sticky lg:top-24", cart.isLoading && "opacity-80")}>
            <CartSummary
              subtotal={totals.subtotal}
              tax={totals.tax}
              discount={totals.discount}
              total={totals.total}
              currency={totals.currency}
              deliveryMessage={cart.deliveryMessage}
              isSubmitting={isMutating || cart.isLoading}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
