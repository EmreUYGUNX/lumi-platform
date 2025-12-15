/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { describe, expect, it, jest } from "@jest/globals";
import type { Request, RequestHandler } from "express";
import request from "supertest";

import type { AuthenticatedUser } from "@/modules/auth/token.types.js";
import { withTestApp } from "@/testing/index.js";

import type { CustomizationService } from "../customization.service.js";

const parseUserHeader = (req: Request): AuthenticatedUser | undefined => {
  const header = req.get("x-auth-user");
  if (!header) {
    return undefined;
  }

  try {
    return JSON.parse(header) as AuthenticatedUser;
  } catch {
    return undefined;
  }
};

const requireAuthMiddleware: RequestHandler = (req, _res, next) => {
  const { UnauthorizedError } = jest.requireActual("@/lib/errors.js") as {
    UnauthorizedError: new (...args: ConstructorParameters<typeof Error>) => Error;
  };

  const user = parseUserHeader(req);
  if (!user) {
    next(new UnauthorizedError("Authentication required."));
    return;
  }

  req.user = user;
  next();
};

jest.mock("@/middleware/auth/requireAuth.js", () => ({
  createRequireAuthMiddleware: () => requireAuthMiddleware,
}));

jest.mock("@/middleware/auth/requireRole.js", () => ({
  createRequireRoleMiddleware: (roles: readonly string[]) =>
    ((req, _res, next) => {
      const { ForbiddenError } = jest.requireActual("@/lib/errors.js") as {
        ForbiddenError: new (...args: ConstructorParameters<typeof Error>) => Error;
      };

      const required = roles.map((role) => role.toLowerCase());
      if (required.length === 0) {
        next();
        return;
      }

      const userRoles = new Set((req.user?.roles ?? []).map((role) => role.name.toLowerCase()));
      const allowed = required.some((role) => userRoles.has(role));
      if (allowed) {
        next();
        return;
      }

      next(new ForbiddenError("You do not have permission to perform this action."));
    }) as RequestHandler,
}));

const buildUser = (roleName: string) =>
  ({
    id: `user_${roleName}`,
    email: `${roleName}@example.com`,
    sessionId: `session_${roleName}`,
    permissions: [],
    token: {
      sub: `user_${roleName}`,
      email: `${roleName}@example.com`,
      sessionId: `session_${roleName}`,
      roleIds: [`role_${roleName}`],
      permissions: [],
      jti: `jti-${roleName}`,
      iat: 0,
      exp: 0,
    },
    roles: [{ id: `role_${roleName}`, name: roleName }],
  }) as AuthenticatedUser;

const buildConfig = () => ({
  enabled: true,
  designAreas: [
    {
      name: "front",
      x: 0,
      y: 0,
      width: 200,
      height: 200,
      rotation: 0,
      minDesignSize: 40,
      maxDesignSize: 180,
      allowResize: true,
      allowRotation: true,
    },
  ],
  maxLayers: 10,
  allowImages: true,
  allowText: true,
  allowShapes: false,
  allowDrawing: false,
  allowedFonts: [],
  restrictedWords: [],
  basePriceModifier: 0,
  pricePerLayer: 0,
});

const createServiceStub = () => {
  const config = buildConfig();
  return {
    config,
    stub: {
      getProductCustomization: jest.fn().mockResolvedValue(config),
      enableCustomization: jest.fn(),
      updateCustomization: jest.fn(),
      updateDesignAreas: jest.fn(),
      disableCustomization: jest.fn(),
      validateDesignAreaCoordinates: jest.fn(),
    },
  };
};

const appOptionsWithService = (service: CustomizationService) => ({
  apiOptions: {
    customizationOptions: { service },
  },
  configOverrides: {
    cache: {
      redisUrl: "",
    },
  },
});

describe("customization router", () => {
  it("returns customization config for enabled products", async () => {
    const { stub, config } = createServiceStub();

    await withTestApp(
      async ({ app }) => {
        const productId = "ckl7apwqq0000u1sdf9x0w3w4";
        const response = await request(app)
          .get(`/api/v1/products/${productId}/customization`)
          .expect(200);

        expect(stub.getProductCustomization).toHaveBeenCalledWith(productId);
        expect(response.body.success).toBe(true);
        expect(response.body.data.designAreas[0].name).toBe(config.designAreas[0].name);
      },
      appOptionsWithService(stub as unknown as CustomizationService),
    );
  });

  it("returns customization config for admins including disabled records", async () => {
    const { stub, config } = createServiceStub();
    const productId = "ckl7apwqq0000u1sdf9x0w3w4";
    const adminHeader = JSON.stringify(buildUser("admin"));

    stub.getProductCustomization.mockResolvedValue({ ...config, enabled: false });

    await withTestApp(
      async ({ app }) => {
        const response = await request(app)
          .get(`/api/v1/admin/products/${productId}/customization`)
          .set("x-auth-user", adminHeader)
          .expect(200);

        expect(stub.getProductCustomization).toHaveBeenCalledWith(productId, {
          includeDisabled: true,
        });
        expect(response.body.success).toBe(true);
        expect(response.body.data.enabled).toBe(false);
      },
      appOptionsWithService(stub as unknown as CustomizationService),
    );
  });
});
