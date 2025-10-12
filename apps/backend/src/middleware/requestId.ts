import { randomUUID } from "node:crypto";

import type { Request, RequestHandler, Response } from "express";

import { withRequestContext } from "../lib/logger.js";

export interface RequestIdOptions {
  /**
   * Allows overriding the header used to propagate request identifiers.
   * Defaults to `X-Request-Id`.
   */
  header?: string;
  /**
   * Toggle accepting incoming request identifiers from clients. When disabled,
   * every request receives a freshly generated identifier.
   */
  trustIncomingHeader?: boolean;
}

const DEFAULT_HEADER = "X-Request-Id";
const SAFE_REQUEST_ID = /^[\w.:-]+$/;
const MAX_REQUEST_ID_LENGTH = 128;

const extractIncomingRequestId = (request: Request, header: string): string | undefined => {
  const value = request.get(header);
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_REQUEST_ID_LENGTH) {
    return undefined;
  }

  if (!SAFE_REQUEST_ID.test(trimmed)) {
    return undefined;
  }

  return trimmed;
};

const resolveRequestId = (
  request: Request,
  header: string,
  trustIncomingHeader: boolean,
): string => {
  const incoming = trustIncomingHeader ? extractIncomingRequestId(request, header) : undefined;
  return incoming ?? randomUUID();
};

const assignRequestId = (
  request: Request,
  response: Response,
  header: string,
  trustIncomingHeader: boolean,
): string => {
  const requestId = resolveRequestId(request, header, trustIncomingHeader);
  request.id = requestId;
  response.locals.requestId = requestId;
  response.setHeader(header, requestId);

  return requestId;
};

export const createRequestIdMiddleware = (options: RequestIdOptions = {}): RequestHandler => {
  const header = options.header ?? DEFAULT_HEADER;
  const trustIncomingHeader = options.trustIncomingHeader ?? true;

  return (request, response, next) => {
    const requestId = assignRequestId(request, response, header, trustIncomingHeader);
    withRequestContext({ requestId }, next);
  };
};

export const REQUEST_ID_HEADER = DEFAULT_HEADER;
