import { z } from "zod";

import { moneySchema } from "@lumi/shared/dto";

export const checkoutStepSchema = z.enum(["shipping", "payment", "review"]);
export type CheckoutStep = z.infer<typeof checkoutStepSchema>;

export const shippingMethodSchema = z.enum(["standard", "express", "next_day"]);
export type ShippingMethod = z.infer<typeof shippingMethodSchema>;

export const checkoutAddressSchema = z
  .object({
    id: z.string().optional(),
    label: z.string().optional(),
    fullName: z.string().min(2),
    email: z.string().email().optional(),
    phone: z.string().min(5),
    line1: z.string().min(3),
    line2: z.string().optional(),
    city: z.string().min(2),
    state: z.string().min(2),
    postalCode: z.string().min(3),
    country: z.string().min(2),
    saveAddress: z.boolean().optional(),
  })
  .strict();

export type CheckoutAddress = z.infer<typeof checkoutAddressSchema>;

export const checkoutNotesSchema = z.string().max(500).optional();

export const checkoutOrderItemSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    quantity: z.number().int().positive(),
    unitPrice: moneySchema,
  })
  .strict();

export type CheckoutOrderItem = z.infer<typeof checkoutOrderItemSchema>;

export interface CheckoutOrderSnapshot {
  id: string;
  reference?: string | null;
  total: z.infer<typeof moneySchema>;
  estimatedDelivery?: string;
  items: CheckoutOrderItem[];
  shippingMethod?: ShippingMethod;
  createdAt?: string;
}

export interface CheckoutStateSnapshot {
  step: CheckoutStep;
  shippingAddress?: CheckoutAddress;
  billingAddress?: CheckoutAddress;
  billingSameAsShipping: boolean;
  shippingMethod?: ShippingMethod;
  paymentMethod?: string;
  notes?: string;
  lastOrder?: CheckoutOrderSnapshot;
}
