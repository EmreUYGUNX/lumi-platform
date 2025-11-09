import type { Request, RequestHandler, Response } from "express";

import { asyncHandler } from "@/lib/asyncHandler.js";
import { UnauthorizedError } from "@/lib/errors.js";
import { paginatedResponse, successResponse } from "@/lib/response.js";
import type { AuthServiceContract } from "@/modules/auth/auth.service.js";
import { ChangePasswordRequestSchema } from "@/modules/auth/dto/change-password.dto.js";
import { cuidSchema } from "@lumi/shared/dto";

import type { UserService } from "./user.service.js";
import {
  adminUnlockUserSchema,
  adminUserListQuerySchema,
  adminUserStatusSchema,
  createAddressSchema,
  updateAddressSchema,
  userPreferencePatchSchema,
  userProfileUpdateSchema,
} from "./user.validators.js";

const AUDIT_ADDRESS_ENTITY = "user_addresses";
const AUDIT_PREFERENCE_ENTITY = "user_preferences";

const ensureAuthContext = (req: Request) => {
  const { user } = req;
  if (!user) {
    throw new UnauthorizedError("Authentication required.");
  }
  return user;
};

export interface UserControllerOptions {
  service: UserService;
  authService: AuthServiceContract;
}

export class UserController {
  public readonly getProfile: RequestHandler;

  public readonly updateProfile: RequestHandler;

  public readonly changePassword: RequestHandler;

  public readonly listAddresses: RequestHandler;

  public readonly createAddress: RequestHandler;

  public readonly updateAddress: RequestHandler;

  public readonly deleteAddress: RequestHandler;

  public readonly setDefaultAddress: RequestHandler;

  public readonly getPreferences: RequestHandler;

  public readonly updatePreferences: RequestHandler;

  public readonly adminListUsers: RequestHandler;

  public readonly adminGetUser: RequestHandler;

  public readonly adminUpdateStatus: RequestHandler;

  public readonly adminUnlockUser: RequestHandler;

  private readonly service: UserService;

  private readonly authService: AuthServiceContract;

  constructor(options: UserControllerOptions) {
    this.service = options.service;
    this.authService = options.authService;

    this.getProfile = asyncHandler(this.handleGetProfile.bind(this));
    this.updateProfile = asyncHandler(this.handleUpdateProfile.bind(this));
    this.changePassword = asyncHandler(this.handleChangePassword.bind(this));
    this.listAddresses = asyncHandler(this.handleListAddresses.bind(this));
    this.createAddress = asyncHandler(this.handleCreateAddress.bind(this));
    this.updateAddress = asyncHandler(this.handleUpdateAddress.bind(this));
    this.deleteAddress = asyncHandler(this.handleDeleteAddress.bind(this));
    this.setDefaultAddress = asyncHandler(this.handleSetDefaultAddress.bind(this));
    this.getPreferences = asyncHandler(this.handleGetPreferences.bind(this));
    this.updatePreferences = asyncHandler(this.handleUpdatePreferences.bind(this));
    this.adminListUsers = asyncHandler(this.handleAdminListUsers.bind(this));
    this.adminGetUser = asyncHandler(this.handleAdminGetUser.bind(this));
    this.adminUpdateStatus = asyncHandler(this.handleAdminUpdateStatus.bind(this));
    this.adminUnlockUser = asyncHandler(this.handleAdminUnlockUser.bind(this));
  }

  private async handleGetProfile(req: Request, res: Response): Promise<void> {
    const user = ensureAuthContext(req);
    const profile = await this.service.getProfile(user.id);
    res.json(successResponse(profile));
  }

  private async handleUpdateProfile(req: Request, res: Response): Promise<void> {
    const user = ensureAuthContext(req);
    const input = userProfileUpdateSchema.parse(req.body ?? {});
    const profile = await this.service.updateProfile(user.id, input);

    res.locals.audit = {
      entity: this.service.getAuditEntity(),
      entityId: user.id,
      action: "users.update-profile",
      after: input,
    };

    res.json(successResponse(profile));
  }

  private async handleChangePassword(req: Request, res: Response): Promise<void> {
    const user = ensureAuthContext(req);
    const payload = ChangePasswordRequestSchema.parse(req.body ?? {});
    const result = await this.authService.changePassword(user.id, user.sessionId, payload);

    res.locals.audit = {
      entity: this.service.getAuditEntity(),
      entityId: user.id,
      action: "users.change-password",
    };

    res.json(successResponse({ user: result.user }));
  }

  private async handleListAddresses(req: Request, res: Response): Promise<void> {
    const user = ensureAuthContext(req);
    const addresses = await this.service.listAddresses(user.id);
    res.json(successResponse(addresses));
  }

  private async handleCreateAddress(req: Request, res: Response): Promise<void> {
    const user = ensureAuthContext(req);
    const input = createAddressSchema.parse(req.body ?? {});
    const address = await this.service.createAddress(user.id, input);

    res.locals.audit = {
      entity: AUDIT_ADDRESS_ENTITY,
      entityId: address.id,
      action: "users.address.create",
      after: address,
    };

    res.status(201).json(successResponse(address));
  }

  private async handleUpdateAddress(req: Request, res: Response): Promise<void> {
    const user = ensureAuthContext(req);
    const addressId = cuidSchema.parse(req.params.addressId);
    const input = updateAddressSchema.parse(req.body ?? {});
    const address = await this.service.updateAddress(user.id, addressId, input);

    res.locals.audit = {
      entity: AUDIT_ADDRESS_ENTITY,
      entityId: address.id,
      action: "users.address.update",
      after: address,
    };

    res.json(successResponse(address));
  }

  private async handleDeleteAddress(req: Request, res: Response): Promise<void> {
    const user = ensureAuthContext(req);
    const addressId = cuidSchema.parse(req.params.addressId);
    await this.service.deleteAddress(user.id, addressId);

    res.locals.audit = {
      entity: AUDIT_ADDRESS_ENTITY,
      entityId: addressId,
      action: "users.address.delete",
    };

    res.status(204).send();
  }

  private async handleSetDefaultAddress(req: Request, res: Response): Promise<void> {
    const user = ensureAuthContext(req);
    const addressId = cuidSchema.parse(req.params.addressId);
    const addresses = await this.service.setDefaultAddress(user.id, addressId);

    res.locals.audit = {
      entity: AUDIT_ADDRESS_ENTITY,
      entityId: addressId,
      action: "users.address.set-default",
    };

    res.json(successResponse(addresses));
  }

  private async handleGetPreferences(req: Request, res: Response): Promise<void> {
    const user = ensureAuthContext(req);
    const preference = await this.service.getPreferences(user.id);
    res.json(successResponse(preference));
  }

  private async handleUpdatePreferences(req: Request, res: Response): Promise<void> {
    const user = ensureAuthContext(req);
    const input = userPreferencePatchSchema.parse(req.body ?? {});
    const preference = await this.service.updatePreferences(user.id, input);

    res.locals.audit = {
      entity: AUDIT_PREFERENCE_ENTITY,
      entityId: user.id,
      action: "users.preferences.update",
      after: input,
    };

    res.json(successResponse(preference));
  }

  private async handleAdminListUsers(req: Request, res: Response): Promise<void> {
    const query = adminUserListQuerySchema.parse(req.query ?? {});
    if (query.format === "csv") {
      const exportResult = await this.service.exportAdminUsers(query);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${exportResult.filename}"`);
      res.send(exportResult.content);
      return;
    }

    const result = await this.service.adminListUsers(query);
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

  private async handleAdminGetUser(req: Request, res: Response): Promise<void> {
    const userId = cuidSchema.parse(req.params.id);
    const detail = await this.service.adminGetUser(userId);
    res.json(successResponse(detail));
  }

  private async handleAdminUpdateStatus(req: Request, res: Response): Promise<void> {
    const userId = cuidSchema.parse(req.params.id);
    const input = adminUserStatusSchema.parse(req.body ?? {});
    const detail = await this.service.adminUpdateStatus(userId, input);

    res.locals.audit = {
      entity: this.service.getAuditEntity(),
      entityId: userId,
      action: "admin.users.update-status",
      after: input,
    };

    res.json(successResponse(detail));
  }

  private async handleAdminUnlockUser(req: Request, res: Response): Promise<void> {
    const userId = cuidSchema.parse(req.params.id);
    const input = adminUnlockUserSchema.parse(req.body ?? {});
    const detail = await this.service.adminUnlockUser(userId, input);

    res.locals.audit = {
      entity: this.service.getAuditEntity(),
      entityId: userId,
      action: "admin.users.unlock",
      after: input,
    };

    res.json(successResponse(detail));
  }
}
