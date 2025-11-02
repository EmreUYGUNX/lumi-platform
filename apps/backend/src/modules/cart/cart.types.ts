import type { InventoryPolicy } from "@prisma/client";

import type { CartItemDTO, CartSummaryDTO, MoneyDTO, ProductVariantDTO } from "@lumi/shared/dto";

export type CartOperationName =
  | "add_item"
  | "update_item"
  | "remove_item"
  | "clear_cart"
  | "merge_cart"
  | "validate_cart";

export interface CartProductBrief {
  id: string;
  title: string;
  slug: string;
  status: "ACTIVE" | "DRAFT" | "ARCHIVED";
  inventoryPolicy: InventoryPolicy;
  price: MoneyDTO;
  compareAtPrice?: MoneyDTO;
  currency: string;
}

export type CartItemWithProduct = CartItemDTO & {
  product: CartProductBrief;
  variant: ProductVariantDTO;
  availableStock: number;
};

export type CartSummaryWithProducts = Omit<CartSummaryDTO, "items"> & {
  items: CartItemWithProduct[];
};

export type CartStockIssueType = "variant_unavailable" | "out_of_stock" | "low_stock";

export interface CartStockIssue {
  type: CartStockIssueType;
  itemId: string;
  variantId: string;
  productId: string;
  requestedQuantity: number;
  availableQuantity: number;
  message: string;
}

export interface CartStockStatus {
  status: "ok" | "warning" | "error";
  issues: CartStockIssue[];
  checkedAt: string;
}

export interface CartDeliveryEstimate {
  status: "standard" | "delayed" | "backorder" | "unknown";
  minHours?: number;
  maxHours?: number;
  estimatedDeliveryDate?: string;
  message: string;
}

export interface CartSummaryView {
  cart: CartSummaryWithProducts;
  stock: CartStockStatus;
  delivery: CartDeliveryEstimate;
}

export type CartValidationIssueType =
  | "variant_unavailable"
  | "product_unavailable"
  | "out_of_stock"
  | "low_stock"
  | "price_mismatch";

export interface CartValidationIssueBase {
  type: CartValidationIssueType;
  itemId: string;
  variantId: string;
  productId: string;
  message: string;
}

export type CartValidationIssue =
  | (CartValidationIssueBase & {
      type: "variant_unavailable" | "product_unavailable";
    })
  | (CartValidationIssueBase & {
      type: "out_of_stock" | "low_stock";
      requestedQuantity: number;
      availableQuantity: number;
    })
  | (CartValidationIssueBase & {
      type: "price_mismatch";
      expectedUnitPrice: MoneyDTO;
      actualUnitPrice: MoneyDTO;
    });

export interface CartValidationReport {
  cartId: string;
  valid: boolean;
  issues: CartValidationIssue[];
  stock: CartStockStatus;
  totals: CartSummaryDTO["totals"];
  checkedAt: string;
}
