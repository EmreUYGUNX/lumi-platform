import { describe, expect, it, jest } from "@jest/globals";
import type { Request, Response } from "express";

import { UnauthorizedError } from "@/lib/errors.js";
import type { AuthServiceContract } from "@/modules/auth/auth.service.js";
import type { AddressDTO, UserDetailDTO } from "@lumi/shared/dto";

import { UserController } from "../user.controller.js";
import type { UserProfileResult, UserService } from "../user.service.js";

const createRequest = (overrides: Partial<Request> = {}): Request =>
  ({
    body: {},
    params: {},
    query: {},
    user: { id: "user_1", sessionId: "session_1" },
    ...overrides,
  }) as Request;

const createResponse = (): Response =>
  ({
    json: jest.fn(),
    status: jest.fn().mockReturnThis(),
    send: jest.fn(),
    locals: {},
  }) as unknown as Response;

const buildController = () => {
  const service = {
    getProfile: jest.fn(),
    updateProfile: jest.fn(),
    listAddresses: jest.fn(),
    createAddress: jest.fn(),
    updatePreferences: jest.fn(),
    getAuditEntity: jest.fn().mockReturnValue("users"),
    adminListUsers: jest.fn(),
  } as unknown as jest.Mocked<UserService>;

  const authService = {
    changePassword: jest.fn(),
  } as unknown as jest.Mocked<AuthServiceContract>;

  const controller = new UserController({
    service,
    authService,
  });

  return { controller, service, authService };
};

describe("UserController", () => {
  it("returns profile data when requester is authenticated", async () => {
    const { controller, service } = buildController();
    const profile = {
      user: {
        id: "user_1",
        email: "user@example.com",
        firstName: "Test",
        lastName: "User",
        fullName: "Test User",
        // eslint-disable-next-line unicorn/no-null -- User DTOs allow nullable phone values.
        phone: null,
        status: "ACTIVE",
        emailVerified: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        roles: [],
        permissions: [],
        preferences: {},
        twoFactorEnabled: false,
      } as unknown as UserDetailDTO,
      addresses: [],
      preferences: {},
    } as unknown as UserProfileResult;
    service.getProfile.mockResolvedValue(profile);

    const req = createRequest();
    const res = createResponse();
    const next = jest.fn();

    await controller.getProfile(req, res, next);

    expect(service.getProfile).toHaveBeenCalledWith("user_1");
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: profile,
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("propagates UnauthorizedError when authentication context missing", async () => {
    const { controller } = buildController();
    const req = createRequest({ user: undefined });
    const res = createResponse();
    const next = jest.fn();

    await controller.getProfile(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it("creates addresses and records audit metadata", async () => {
    const { controller, service } = buildController();
    service.createAddress.mockResolvedValue({
      id: "addr_1",
      userId: "user_1",
      label: "Home",
      fullName: "Test User",
      // eslint-disable-next-line unicorn/no-null -- Address DTO fields remain nullable.
      phone: null,
      line1: "Street 1",
      // eslint-disable-next-line unicorn/no-null -- Address DTO fields remain nullable.
      line2: null,
      city: "Istanbul",
      // eslint-disable-next-line unicorn/no-null -- Address DTO fields remain nullable.
      state: null,
      postalCode: "34000",
      country: "TR",
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as AddressDTO);

    const req = createRequest({
      body: {
        label: "Home",
        fullName: "Test User",
        line1: "Street 1",
        city: "Istanbul",
        country: "TR",
        postalCode: "34000",
      },
    });
    const res = createResponse();
    const next = jest.fn();

    await controller.createAddress(req, res, next);

    expect(service.createAddress).toHaveBeenCalledWith(
      "user_1",
      expect.objectContaining({
        label: "Home",
        country: "TR",
      }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
    expect(res.locals).toMatchObject({
      audit: expect.objectContaining({
        entity: "user_addresses",
        action: "users.address.create",
      }),
    });
  });

  it("lists admin users with parsed query filters", async () => {
    const { controller, service } = buildController();
    service.adminListUsers.mockResolvedValue({
      items: [],
      meta: {
        page: 1,
        pageSize: 25,
        totalItems: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    });

    const req = createRequest({
      query: {
        page: "2",
        pageSize: "10",
        status: ["ACTIVE"],
        role: "manager",
      },
    });
    const res = createResponse();
    const next = jest.fn();

    await controller.adminListUsers(req, res, next);

    expect(service.adminListUsers).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        pageSize: 10,
        status: ["ACTIVE"],
        role: "manager",
      }),
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: [],
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });
});
