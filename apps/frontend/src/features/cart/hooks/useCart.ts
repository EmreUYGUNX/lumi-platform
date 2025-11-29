import { useEffect, useMemo } from "react";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";

import type { CartSummaryView } from "../types/cart.types";
import { cartSummaryViewSchema } from "../types/cart.types";
import { useCartStore } from "../store/cart.store";
import { cartKeys } from "./cart.keys";

interface UseCartOptions {
  enabled?: boolean;
  initialData?: CartSummaryView;
  authToken?: string;
}

export const useCart = (options: UseCartOptions = {}) => {
  const persistedView = useCartStore((state) => state.view);
  const sync = useCartStore((state) => state.sync);
  const snapshot = useCartStore((state) => ({
    items: state.items,
    itemCount: state.itemCount,
    subtotal: state.subtotal,
    tax: state.tax,
    discount: state.discount,
    total: state.total,
    currency: state.currency,
    stockIssues: state.stockIssues,
    deliveryMessage: state.deliveryMessage,
  }));

  const initialData = useMemo(
    () => options.initialData ?? persistedView,
    [options.initialData, persistedView],
  );

  const query = useQuery<CartSummaryView>({
    queryKey: cartKeys.summary(),
    queryFn: async () => {
      const response = await apiClient.get("/cart", {
        dataSchema: cartSummaryViewSchema,
        authToken: options.authToken,
      });
      return response.data;
    },
    initialData,
    placeholderData: (previous) => previous ?? initialData,
    enabled: options.enabled ?? true,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (query.data) {
      sync(query.data);
    }
  }, [query.data, sync]);

  const view = query.data ?? initialData;
  const items = view?.cart.items ?? snapshot.items;

  return {
    ...query,
    data: view,
    items,
    itemCount: view?.cart.items.reduce((sum, item) => sum + item.quantity, 0) ?? snapshot.itemCount,
    totals: {
      subtotal: snapshot.subtotal,
      tax: snapshot.tax,
      discount: snapshot.discount,
      total: snapshot.total,
      currency: snapshot.currency,
    },
    stockIssues: view?.stock.issues ?? snapshot.stockIssues,
    deliveryMessage: view?.delivery.message ?? snapshot.deliveryMessage,
  };
};
