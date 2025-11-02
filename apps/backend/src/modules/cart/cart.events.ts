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
  "cart.item_added": [CartItemAddedEvent];
  "cart.item_updated": [CartItemUpdatedEvent];
  "cart.item_removed": [CartItemRemovedEvent];
  "cart.cleared": [CartClearedEvent];
  "cart.merged": [CartMergedEvent];
  "cart.validated": [CartValidatedEvent];
}

type CartEventName = keyof CartEventMap;
type CartEventPayload<TEvent extends CartEventName> = CartEventMap[TEvent][0];
type CartEventListener<TEvent extends CartEventName> = (payload: CartEventPayload<TEvent>) => void;

const cartEventBus = new EventEmitter();
cartEventBus.setMaxListeners(25);

export const emitCartEvent = <TEvent extends CartEventName>(
  event: TEvent,
  payload: CartEventPayload<TEvent>,
): void => {
  cartEventBus.emit(event, payload);
};

export const onCartEvent = <TEvent extends CartEventName>(
  event: TEvent,
  listener: CartEventListener<TEvent>,
): (() => void) => {
  const handler: (...args: CartEventMap[TEvent]) => void = (payload) => {
    listener(payload);
  };

  cartEventBus.on(event, handler);
  return () => {
    cartEventBus.off(event, handler);
  };
};

export const cartEvents = {
  emit: emitCartEvent,
  on: onCartEvent,
};
