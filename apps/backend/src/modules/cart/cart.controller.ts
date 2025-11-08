import type { Request, RequestHandler, Response } from "express";

import { asyncHandler } from "@/lib/asyncHandler.js";
import { UnauthorizedError, ValidationError } from "@/lib/errors.js";
import { successResponse } from "@/lib/response.js";
import { cuidSchema } from "@lumi/shared/dto";

import { type CartContext, type CartService } from "./cart.service.js";
import {
  addCartItemSchema,
  mergeCartSchema,
  updateCartItemSchema,
  validateCartQuerySchema,
} from "./cart.validators.js";

const ensureUserContext = (req: Request): CartContext => {
  const { user } = req;
  if (!user) {
    throw new UnauthorizedError("Authentication required to access cart operations.");
  }

  return {
    userId: user.id,
    sessionId: user.sessionId,
  };
};

export interface CartControllerOptions {
  service: CartService;
}

export class CartController {
  public readonly getCart: RequestHandler;

  public readonly addItem: RequestHandler;

  public readonly updateItem: RequestHandler;

  public readonly removeItem: RequestHandler;

  public readonly clearCart: RequestHandler;

  public readonly mergeCart: RequestHandler;

  public readonly validateCart: RequestHandler;

  private readonly service: CartService;

  constructor(options: CartControllerOptions) {
    this.service = options.service;

    this.getCart = asyncHandler(this.handleGetCart.bind(this));
    this.addItem = asyncHandler(this.handleAddItem.bind(this));
    this.updateItem = asyncHandler(this.handleUpdateItem.bind(this));
    this.removeItem = asyncHandler(this.handleRemoveItem.bind(this));
    this.clearCart = asyncHandler(this.handleClearCart.bind(this));
    this.mergeCart = asyncHandler(this.handleMergeCart.bind(this));
    this.validateCart = asyncHandler(this.handleValidateCart.bind(this));
  }

  private async handleGetCart(req: Request, res: Response): Promise<void> {
    const context = ensureUserContext(req);
    const view = await this.service.getCart(context);
    res.json(successResponse(view));
  }

  private async handleAddItem(req: Request, res: Response): Promise<void> {
    const context = ensureUserContext(req);
    const input = addCartItemSchema.parse(req.body);
    const view = await this.service.addItem(context, input);
    res.status(201).json(successResponse(view));
  }

  private async handleUpdateItem(req: Request, res: Response): Promise<void> {
    const context = ensureUserContext(req);
    const { itemId } = req.params;
    if (!itemId) {
      throw new ValidationError("Cart item identifier is required.", {
        issues: [
          {
            path: "itemId",
            message: "Provide the cart item identifier in the request path.",
          },
        ],
      });
    }

    const id = cuidSchema.parse(itemId);
    const input = updateCartItemSchema.parse(req.body);
    const view = await this.service.updateItem(context, id, input);
    res.json(successResponse(view));
  }

  private async handleRemoveItem(req: Request, res: Response): Promise<void> {
    const context = ensureUserContext(req);
    const { itemId } = req.params;
    if (!itemId) {
      throw new ValidationError("Cart item identifier is required.", {
        issues: [
          {
            path: "itemId",
            message: "Provide the cart item identifier in the request path.",
          },
        ],
      });
    }

    const id = cuidSchema.parse(itemId);
    const view = await this.service.removeItem(context, id);
    res.json(successResponse(view));
  }

  private async handleClearCart(req: Request, res: Response): Promise<void> {
    const context = ensureUserContext(req);
    const view = await this.service.clearCart(context);
    res.json(successResponse(view));
  }

  private async handleMergeCart(req: Request, res: Response): Promise<void> {
    const { user } = req;
    if (!user) {
      throw new UnauthorizedError("Authentication required to merge carts.");
    }

    const input = mergeCartSchema.parse(req.body);
    const view = await this.service.mergeCart(user.id, input);
    res.json(successResponse(view));
  }

  private async handleValidateCart(req: Request, res: Response): Promise<void> {
    const context = ensureUserContext(req);
    const query = validateCartQuerySchema.parse(req.query);
    const report = await this.service.validateCart(context, query);
    res.json(successResponse(report));
  }
}
