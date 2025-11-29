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
  const items = useCartStore((state) => state.items);
  const itemCount = useCartStore((state) => state.itemCount);
  const subtotal = useCartStore((state) => state.subtotal);
  const tax = useCartStore((state) => state.tax);
  const discount = useCartStore((state) => state.discount);
  const total = useCartStore((state) => state.total);
  const currency = useCartStore((state) => state.currency);
  const stockIssues = useCartStore((state) => state.stockIssues);
  const deliveryMessage = useCartStore((state) => state.deliveryMessage);

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
  const hydratedItems = view?.cart.items ?? items;

  return {
    ...query,
    data: view,
    items: hydratedItems,
    itemCount: view?.cart.items.reduce((sum, item) => sum + item.quantity, 0) ?? itemCount,
    totals: {
      subtotal,
      tax,
      discount,
      total,
      currency,
    },
    stockIssues: view?.stock.issues ?? stockIssues,
    deliveryMessage: view?.delivery.message ?? deliveryMessage,
  };
};
