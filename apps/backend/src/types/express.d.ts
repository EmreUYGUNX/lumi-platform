import type { IncomingHttpHeaders } from "node:http";

import type { AuditLogEntry } from "../audit/audit-log.service.js";
import type { ErrorInput, ResponseMeta } from "../middleware/response-formatter.js";

declare global {
  namespace Express {
    interface Request {
      /**
       * Unique request identifier assigned by the response formatter middleware.
       */
      requestId?: string;
      /**
       * Authenticated user context surfaced by the authentication middleware stack.
       */
      user?: {
        id: string;
        email?: string;
        role: string;
        permissions?: string[];
        [key: string]: unknown;
      };
      /**
       * Raw request headers for strongly typed access.
       */
      headers: IncomingHttpHeaders & {
        "x-request-id"?: string;
        "x-internal-service"?: string;
      };
    }

    interface Response {
      /**
       * Mirrors the active request identifier for downstream consumers (logger, error handler, etc.).
       */
      requestId?: string;
      /**
       * Sends a Q2 compliant success response. Injected by the response formatter middleware.
       */
      success?<T>(data: T, meta?: Partial<ResponseMeta>): this;
      /**
       * Sends a Q2 compliant error response. Injected by the response formatter middleware.
       */
      error?(error: ErrorInput, meta?: Partial<ResponseMeta>): this;
    }

    interface Locals {
      audit?: Pick<
        AuditLogEntry,
        "action" | "entity" | "entityId" | "before" | "after" | "metadata"
      > &
        Record<string, unknown>;
    }
  }
}

export {};
