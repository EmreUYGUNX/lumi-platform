import type { IncomingHttpHeaders } from "node:http";

import type { AuditLogEntry } from "../audit/audit-log.service.js";
import type { ErrorInput, ResponseMeta } from "../middleware/response-formatter.js";
import type { AuthenticatedUser, RequestAuthState } from "../modules/auth/token.types.js";

declare global {
  namespace Express {
    interface Request {
      /**
       * Unique request identifier assigned by the response formatter middleware.
       */
      requestId?: string;
      /**
       * Legacy alias used by middleware to access the request identifier. Mirrors requestId.
       */
      id?: string;
      /**
       * Authenticated user context surfaced by the authentication middleware stack.
       */
      user?: AuthenticatedUser;
      /**
       * Auth metadata captured during authentication (token state, errors, etc.).
       */
      auth?: RequestAuthState;
      /**
       * Raw request headers for strongly typed access.
       */
      headers: IncomingHttpHeaders & {
        "x-request-id"?: string;
        "x-internal-service"?: string;
      };
      /**
       * Raw request payload captured before body parsing. Used for webhook signature validation.
       */
      rawBody?: string;
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
