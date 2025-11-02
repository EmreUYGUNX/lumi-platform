import { EventEmitter } from "node:events";

import type { CartSummaryView, CartValidationReport } from "./cart.types.js";

export interface CartBaseEvent {
  cartId: string;
  userId?: string;
  sessionId?: string;
}

export interface CartItemEvent extends CartBaseEvent {
  itemId: string;
  variantId: string;
}

export interface CartItemAddedEvent extends CartItemEvent {
  quantity: number;
  previousQuantity: number;
  summary: CartSummaryView;
}

export interface CartItemUpdatedEvent extends CartItemEvent {
  quantity: number;
  previousQuantity: number;
  summary: CartSummaryView;
}

export interface CartItemRemovedEvent extends CartItemEvent {
  previousQuantity: number;
}

export interface CartClearedEvent extends CartBaseEvent {
  removedItemCount: number;
}

export interface CartMergedEvent {
  sourceCartId: string;
  targetCartId: string;
  userId: string;
  mergedItemCount: number;
}

export interface CartValidatedEvent extends CartBaseEvent {
  report: CartValidationReport;
}

export interface CartEventMap {
  "cart.item_added": CartItemAddedEvent;
  "cart.item_updated": CartItemUpdatedEvent;
  "cart.item_removed": CartItemRemovedEvent;
  "cart.cleared": CartClearedEvent;
  "cart.merged": CartMergedEvent;
  "cart.validated": CartValidatedEvent;
}

type CartEventName = keyof CartEventMap;
type CartEventListener<TEvent extends CartEventName> = (payload: CartEventMap[TEvent]) => void;

class CartEventBus extends EventEmitter {
  emit<TEvent extends CartEventName>(event: TEvent, payload: CartEventMap[TEvent]): boolean {
    return super.emit(event, payload);
  }

  on<TEvent extends CartEventName>(event: TEvent, listener: CartEventListener<TEvent>): this {
    return super.on(event, listener);
  }

  off<TEvent extends CartEventName>(event: TEvent, listener: CartEventListener<TEvent>): this {
    return super.off(event, listener);
  }
}

const cartEventBus = new CartEventBus().setMaxListeners(25);

export const emitCartEvent = <TEvent extends CartEventName>(
  event: TEvent,
  payload: CartEventMap[TEvent],
): void => {
  cartEventBus.emit(event, payload);
};

export const onCartEvent = <TEvent extends CartEventName>(
  event: TEvent,
  listener: CartEventListener<TEvent>,
): (() => void) => {
  cartEventBus.on(event, listener);
  return () => {
    cartEventBus.off(event, listener);
  };
};

export const cartEvents = {
  emit: emitCartEvent,
  on: onCartEvent,
};
