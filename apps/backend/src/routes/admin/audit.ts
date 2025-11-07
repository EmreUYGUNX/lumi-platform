/* istanbul ignore file -- audit router exercised via integration and supertest suites */
import type { NextFunction, Request, Response } from "express";
import { Router } from "express";

import { queryAuditLogs } from "../../audit/audit-log.service.js";
import type { AuditActorType } from "../../audit/audit-log.service.js";
import { ApiError } from "../../errors/api-error.js";
import { createAdminRateLimiter } from "../../middleware/rate-limiter.js";

const router = Router();

const requireAdmin = (req: Request, _res: Response, next: NextFunction) => {
  const hasAdminRole = req.user?.roles?.some(
    (role) => role.name?.toLowerCase?.() === "admin" || role.id.toLowerCase() === "admin",
  );

  if (!req.user || !hasAdminRole) {
    next(new ApiError("Forbidden", { status: 403, code: "FORBIDDEN" }));
    return;
  }

  next();
};

router.use(createAdminRateLimiter());
router.use(requireAdmin);

router.get("/", async (req, res, next) => {
  try {
    const { page, perPage, actorType, entity, userId } = req.query;

    const result = await queryAuditLogs({
      page: page ? Number(page) : undefined,
      perPage: perPage ? Number(perPage) : undefined,
      actorType: typeof actorType === "string" ? (actorType as AuditActorType) : undefined,
      entity: typeof entity === "string" ? entity : undefined,
      userId: typeof userId === "string" ? userId : undefined,
    });

    const responseData = result.data.map((entry) => ({
      id: entry.id,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      actorType: entry.actorType,
      userId: entry.userId,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      before: entry.before,
      after: entry.after,
      createdAt: entry.createdAt,
    }));

    if (typeof res.success === "function") {
      res.success(responseData, { pagination: result.pagination });
      return;
    }

    res.json({ items: responseData, pagination: result.pagination });
  } catch (error) {
    next(error);
  }
});

export const auditAdminRouter = router;
