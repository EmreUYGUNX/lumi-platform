import type { Request, RequestHandler, Response } from "express";

import { asyncHandler } from "@/lib/asyncHandler.js";
import { UnauthorizedError, ValidationError } from "@/lib/errors.js";
import { paginatedResponse, successResponse } from "@/lib/response.js";
import { cuidSchema } from "@lumi/shared/dto";

import type { OrderService } from "./order.service.js";
import {
  adminOrderListQuerySchema,
  createOrderInputSchema,
  orderCancellationSchema,
  orderListQuerySchema,
  orderNoteSchema,
  orderRefundSchema,
  orderStatsQuerySchema,
  orderStatusUpdateSchema,
  orderTrackingParamsSchema,
} from "./order.validators.js";

const AUDIT_ENTITY = "orders";
const ORDER_ID_REQUIRED_MESSAGE = "Order identifier is required.";

const ensureUserContext = (req: Request) => {
  const { user } = req;
  if (!user) {
    throw new UnauthorizedError("Authentication required.");
  }

  return {
    userId: user.id,
    sessionId: user.sessionId,
    email: user.email,
    firstName: undefined,
  };
};

export interface OrderControllerOptions {
  service: OrderService;
}

export class OrderController {
  public readonly createOrder: RequestHandler;

  public readonly listOrders: RequestHandler;

  public readonly getOrder: RequestHandler;

  public readonly cancelOrder: RequestHandler;

  public readonly trackOrder: RequestHandler;

  public readonly adminListOrders: RequestHandler;

  public readonly adminGetOrder: RequestHandler;

  public readonly adminUpdateStatus: RequestHandler;

  public readonly adminAddNote: RequestHandler;

  public readonly adminProcessRefund: RequestHandler;

  public readonly adminStats: RequestHandler;

  private readonly service: OrderService;

  constructor(options: OrderControllerOptions) {
    this.service = options.service;
    this.createOrder = asyncHandler(this.handleCreateOrder.bind(this));
    this.listOrders = asyncHandler(this.handleListOrders.bind(this));
    this.getOrder = asyncHandler(this.handleGetOrder.bind(this));
    this.cancelOrder = asyncHandler(this.handleCancelOrder.bind(this));
    this.trackOrder = asyncHandler(this.handleTrackOrder.bind(this));
    this.adminListOrders = asyncHandler(this.handleAdminListOrders.bind(this));
    this.adminGetOrder = asyncHandler(this.handleAdminGetOrder.bind(this));
    this.adminUpdateStatus = asyncHandler(this.handleAdminUpdateStatus.bind(this));
    this.adminAddNote = asyncHandler(this.handleAdminAddNote.bind(this));
    this.adminProcessRefund = asyncHandler(this.handleAdminProcessRefund.bind(this));
    this.adminStats = asyncHandler(this.handleAdminStats.bind(this));
  }

  private async handleCreateOrder(req: Request, res: Response): Promise<void> {
    const context = ensureUserContext(req);
    const body = createOrderInputSchema.parse(req.body);
    const result = await this.service.createOrder(context, body);

    res.locals.audit = {
      entity: AUDIT_ENTITY,
      entityId: result.order.id,
      action: "orders.create",
      after: result.order,
    };

    res.status(201).json(successResponse(result));
  }

  private async handleListOrders(req: Request, res: Response): Promise<void> {
    const context = ensureUserContext(req);
    const query = orderListQuerySchema.parse(req.query);
    const result = await this.service.listUserOrders(context.userId, query);
    res.json(
      paginatedResponse(result.items, {
        totalItems: result.meta.totalItems,
        page: result.meta.page,
        pageSize: result.meta.pageSize,
        totalPages: result.meta.totalPages,
        hasNextPage: result.meta.hasNextPage,
        hasPreviousPage: result.meta.hasPreviousPage,
      }),
    );
  }

  private async handleGetOrder(req: Request, res: Response): Promise<void> {
    const context = ensureUserContext(req);
    const { id } = req.params;
    if (!id) {
      throw new ValidationError(ORDER_ID_REQUIRED_MESSAGE);
    }
    const orderId = cuidSchema.parse(id);
    const detail = await this.service.getUserOrder(context.userId, orderId);
    res.json(successResponse(detail));
  }

  private async handleCancelOrder(req: Request, res: Response): Promise<void> {
    const context = ensureUserContext(req);
    const { id } = req.params;
    if (!id) {
      throw new ValidationError(ORDER_ID_REQUIRED_MESSAGE);
    }
    const orderId = cuidSchema.parse(id);
    const body = orderCancellationSchema.parse(req.body ?? {});
    const detail = await this.service.cancelOrder(context, orderId, body);

    res.locals.audit = {
      entity: AUDIT_ENTITY,
      entityId: orderId,
      action: "orders.cancel",
      before: { status: "PENDING" },
      after: { status: detail.status },
    };

    res.json(successResponse(detail));
  }

  private async handleTrackOrder(req: Request, res: Response): Promise<void> {
    const params = orderTrackingParamsSchema.parse(req.params);
    const summary = await this.service.trackOrder(params);
    res.json(successResponse(summary));
  }

  private async handleAdminListOrders(req: Request, res: Response): Promise<void> {
    const query = adminOrderListQuerySchema.parse(req.query);
    if (query.format === "csv") {
      const exportResult = await this.service.exportAdminOrders(query);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${exportResult.filename}"`);
      res.send(exportResult.content);
      return;
    }

    const result = await this.service.listAdminOrders(query);

    res.json(
      paginatedResponse(result.items, {
        totalItems: result.meta.totalItems,
        page: result.meta.page,
        pageSize: result.meta.pageSize,
        totalPages: result.meta.totalPages,
        hasNextPage: result.meta.hasNextPage,
        hasPreviousPage: result.meta.hasPreviousPage,
        meta: result.summary ? { summary: result.summary } : undefined,
      }),
    );
  }

  private async handleAdminGetOrder(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    if (!id) {
      throw new ValidationError(ORDER_ID_REQUIRED_MESSAGE);
    }
    const orderId = cuidSchema.parse(id);
    const detail = await this.service.getAdminOrder(orderId);
    res.json(successResponse(detail));
  }

  private async handleAdminUpdateStatus(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    if (!id) {
      throw new ValidationError(ORDER_ID_REQUIRED_MESSAGE);
    }
    const orderId = cuidSchema.parse(id);
    const body = orderStatusUpdateSchema.parse(req.body);
    const detail = await this.service.updateOrderStatus(orderId, body);

    res.locals.audit = {
      entity: AUDIT_ENTITY,
      entityId: orderId,
      action: "orders.update-status",
      after: { status: detail.status },
    };

    res.json(successResponse(detail));
  }

  private async handleAdminAddNote(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    if (!id) {
      throw new ValidationError(ORDER_ID_REQUIRED_MESSAGE);
    }
    const orderId = cuidSchema.parse(id);
    const body = orderNoteSchema.parse(req.body);
    const { user } = req;
    if (!user) {
      throw new UnauthorizedError("Authentication required.");
    }
    const detail = await this.service.addInternalNote(orderId, body, user.id);

    res.locals.audit = {
      entity: AUDIT_ENTITY,
      entityId: orderId,
      action: "orders.note",
      after: { note: body.message },
    };

    res.json(successResponse(detail));
  }

  private async handleAdminProcessRefund(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    if (!id) {
      throw new ValidationError(ORDER_ID_REQUIRED_MESSAGE);
    }
    const orderId = cuidSchema.parse(id);
    const body = orderRefundSchema.parse(req.body);
    const detail = await this.service.processRefund(orderId, body);

    res.locals.audit = {
      entity: AUDIT_ENTITY,
      entityId: orderId,
      action: "orders.refund",
      after: { status: detail.status },
    };

    res.json(successResponse(detail));
  }

  private async handleAdminStats(_req: Request, res: Response): Promise<void> {
    const query = orderStatsQuerySchema.parse(_req.query ?? {});
    const stats = await this.service.getOrderStats(query);
    res.json(successResponse(stats));
  }
}
