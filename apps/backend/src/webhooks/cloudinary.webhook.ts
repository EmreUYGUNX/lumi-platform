import { createHash, createHmac } from "node:crypto";

import type { RequestHandler } from "express";

import { ApiError } from "@/errors/api-error.js";
import { asyncHandler } from "@/lib/asyncHandler.js";
import { createChildLogger } from "@/lib/logger.js";
import { successResponse } from "@/lib/response.js";
import type { MediaQueueController } from "@/queues/media.queue.js";
import { getMediaQueueController } from "@/queues/media.queue.js";
import type { ApplicationConfig } from "@lumi/types";

import type { CloudinaryWebhookEvent, CloudinaryWebhookPayload } from "./cloudinary.types.js";

const SIGNATURE_HEADER = "x-cld-signature";
const TIMESTAMP_HEADER = "x-cld-timestamp";
const DEFAULT_TIMESTAMP_TOLERANCE_SECONDS = 300;

const normalisePayload = (body: unknown): CloudinaryWebhookPayload => {
  if (body && typeof body === "object") {
    return body as CloudinaryWebhookPayload;
  }

  return {};
};

const computeSignature = (rawBody: string, timestamp: string, secret: string): string => {
  return createHmac("sha256", secret).update(`${rawBody}${timestamp}`).digest("hex");
};

const isTimestampFresh = (timestamp: number, toleranceSeconds: number): boolean => {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return false;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  return Math.abs(nowSeconds - timestamp) <= toleranceSeconds;
};

export interface CloudinaryWebhookHandlerOptions {
  queue?: MediaQueueController;
  timestampToleranceSeconds?: number;
}

export const createCloudinaryWebhookHandler = (
  config: ApplicationConfig,
  options: CloudinaryWebhookHandlerOptions = {},
): RequestHandler => {
  const logger = createChildLogger("media:webhook:cloudinary");
  const queue = options.queue ?? getMediaQueueController(config);
  const toleranceSeconds = options.timestampToleranceSeconds ?? DEFAULT_TIMESTAMP_TOLERANCE_SECONDS;

  return asyncHandler(async (req, res) => {
    const secret = config.media.cloudinary.webhook.signingSecret;
    if (!secret) {
      throw new ApiError("Cloudinary webhook is not configured.", {
        status: 503,
        code: "WEBHOOK_DISABLED",
      });
    }

    const rawBody = req.rawBody ?? JSON.stringify(req.body ?? {});
    const signatureHeader = req.get(SIGNATURE_HEADER) ?? "";
    const timestampHeader = req.get(TIMESTAMP_HEADER) ?? "";
    const timestampValue = Number.parseInt(timestampHeader, 10);

    if (!signatureHeader || !timestampHeader) {
      throw new ApiError("Missing Cloudinary signature headers.", {
        status: 401,
        code: "WEBHOOK_SIGNATURE_MISSING",
      });
    }

    if (!isTimestampFresh(timestampValue, toleranceSeconds)) {
      throw new ApiError("Cloudinary webhook signature expired.", {
        status: 401,
        code: "WEBHOOK_SIGNATURE_EXPIRED",
      });
    }

    const expectedSignature = computeSignature(rawBody, timestampHeader, secret);
    if (expectedSignature !== signatureHeader) {
      throw new ApiError("Invalid Cloudinary webhook signature.", {
        status: 401,
        code: "WEBHOOK_SIGNATURE_INVALID",
      });
    }

    const payload = normalisePayload(req.body);
    const eventType = String(payload.notification_type ?? payload.event ?? "unknown").toLowerCase();
    const eventId =
      payload.notification_id ??
      payload.request_id ??
      payload.asset_id ??
      createHash("sha1").update(`${signatureHeader}:${timestampHeader}:${rawBody}`).digest("hex");

    const event: CloudinaryWebhookEvent = {
      id: eventId,
      type: eventType,
      payload,
      timestamp: timestampValue,
      signature: signatureHeader,
      rawBodyChecksum: createHash("sha256").update(rawBody).digest("hex"),
      attempt: 1,
    };

    await queue.enqueueWebhookEvent({ event });

    logger.info("Cloudinary webhook accepted", {
      eventId,
      type: eventType,
      jobEnqueued: true,
    });

    res.status(202).json(
      successResponse(
        {
          queued: true,
          eventId,
        },
        {
          requestId: req.requestId,
        },
      ),
    );
  });
};
