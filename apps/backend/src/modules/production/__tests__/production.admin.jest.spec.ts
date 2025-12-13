import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Request, RequestHandler } from "express";
import request from "supertest";

import type { AuthenticatedUser } from "@/modules/auth/token.types.js";
import { withTestApp } from "@/testing/index.js";

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

jest.mock("@/audit/audit-log.service.js", () => ({
  recordAuditLog: jest.fn(async () => {}),
}));

const serviceMocks = {
  generateProductionFile: jest.fn(async () => ({
    customizationId: "ckcustom0000000000000000000",
    orderId: "ckorder0000000000000000000",
    orderItemId: "ckitem0000000000000000000",
    productId: "ckproduct00000000000000000",
    productName: "T-Shirt",
    designArea: "front",
    printMethod: "DTG",
    config: {
      resolution: { dpi: 300, width: 5000, height: 5000 },
      format: "png",
      backgroundColor: "transparent",
      colorProfile: "CMYK",
      printMethod: "DTG",
      bleedArea: "5mm",
      safeArea: "10mm",
      quality: 100,
    },
    specs: {
      dpi: 300,
      width: 5000,
      height: 5000,
      bleedMm: 5,
      safeMm: 10,
      bleedPx: 59,
      safePx: 118,
    },
    productionPublicId: "prod_public",
    productionFileUrl: "https://cdn.example/production.png",
    downloadUrl: "https://cdn.example/download",
    downloadExpiresAt: new Date("2999-01-01T00:00:00.000Z").toISOString(),
    generatedAt: new Date("2025-01-01T00:00:00.000Z").toISOString(),
    regenerated: true,
  })),
  getDownloadUrl: jest.fn(async () => ({
    customizationId: "ckcustom0000000000000000000",
    downloadUrl: "https://cdn.example/download",
    expiresAt: new Date("2999-01-01T00:00:00.000Z").toISOString(),
  })),
  getOrderProductionFiles: jest.fn(async () => ({
    orderId: "ckorder0000000000000000000",
    orderReference: "ORDER-1",
    orderStatus: "PAID",
    orderDate: "2025-01-01",
    printSpecs: {
      dpi: 300,
      width: 5000,
      height: 5000,
      bleedMm: 5,
      safeMm: 10,
      bleedPx: 59,
      safePx: 118,
    },
    items: [],
    batchDownload: { available: false, items: [] },
    manifest: {
      orderId: "ckorder0000000000000000000",
      orderDate: "2025-01-01",
      customizations: [],
    },
  })),
};

jest.mock("@/modules/production/production.service.js", () => {
  class ProductionService {
    generateProductionFile = serviceMocks.generateProductionFile;

    getDownloadUrl = serviceMocks.getDownloadUrl;

    getOrderProductionFiles = serviceMocks.getOrderProductionFiles;
  }

  return { ProductionService };
});

const buildUser = (role: "admin" | "staff"): AuthenticatedUser => {
  const roles =
    role === "admin"
      ? ([{ id: "role_admin", name: "admin" }] as AuthenticatedUser["roles"])
      : ([{ id: "role_staff", name: "staff" }] as AuthenticatedUser["roles"]);

  const id = `ckuser${role}00000000000000000`;
  const email = `${role}@example.com`;

  return {
    id,
    email,
    sessionId: `session_${role}`,
    permissions: [],
    token: {
      sub: id,
      email,
      sessionId: `session_${role}`,
      roleIds: roles.map((entry) => entry.id),
      permissions: [],
      jti: `jti-${id}`,
      iat: 0,
      exp: 0,
    },
    roles,
  };
};

describe("admin production routes", () => {
  const orderItemId = "ckitem0000000000000000000";
  const customizationId = "ckcustom0000000000000000000";
  const orderId = "ckorder0000000000000000000";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("allows admins to generate production files", async () => {
    const adminHeader = JSON.stringify(buildUser("admin"));

    await withTestApp(async ({ app }) => {
      const response = await request(app)
        .post("/api/v1/admin/production/generate")
        .set("x-auth-user", adminHeader)
        .send({ orderItemId })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(serviceMocks.generateProductionFile).toHaveBeenCalledWith(orderItemId, {
        force: undefined,
      });
    });
  });

  it("rejects staff users from generating production files", async () => {
    const staffHeader = JSON.stringify(buildUser("staff"));

    await withTestApp(async ({ app }) => {
      const response = await request(app)
        .post("/api/v1/admin/production/generate")
        .set("x-auth-user", staffHeader)
        .send({ orderItemId })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("FORBIDDEN");
      expect(serviceMocks.generateProductionFile).not.toHaveBeenCalled();
    });
  });

  it("allows staff users to download production files", async () => {
    const staffHeader = JSON.stringify(buildUser("staff"));

    await withTestApp(async ({ app }) => {
      const response = await request(app)
        .get(`/api/v1/admin/production/download/${customizationId}`)
        .set("x-auth-user", staffHeader)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(serviceMocks.getDownloadUrl).toHaveBeenCalledWith(customizationId);
    });
  });

  it("lists production files for an order", async () => {
    const adminHeader = JSON.stringify(buildUser("admin"));

    await withTestApp(async ({ app }) => {
      const response = await request(app)
        .get(`/api/v1/admin/production/order/${orderId}`)
        .set("x-auth-user", adminHeader)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(serviceMocks.getOrderProductionFiles).toHaveBeenCalledWith(orderId);
    });
  });
});
