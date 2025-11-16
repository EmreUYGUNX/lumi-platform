import { createHmac } from "node:crypto";

import express, { type Request } from "express";
import request from "supertest";

import type { MediaQueueController } from "@/queues/media.queue.js";
import { createTestConfig } from "@/testing/config.js";
import { createCloudinaryWebhookHandler } from "@/webhooks/cloudinary.webhook.js";

const SIGNING_SECRET = "test-webhook-secret";

const buildSignature = (payload: unknown, timestamp: string): string => {
  const body = JSON.stringify(payload);
  return createHmac("sha256", SIGNING_SECRET).update(`${body}${timestamp}`).digest("hex");
};

const createApp = (handler: ReturnType<typeof createCloudinaryWebhookHandler>) => {
  const app = express();
  app.use(
    express.json({
      verify: (req: Request & { rawBody?: string }, _res, buf) => {
        // eslint-disable-next-line no-param-reassign -- test helper
        req.rawBody = buf.toString("utf8");
      },
    }),
  );
  app.post("/webhooks/cloudinary", handler);
  return app;
};

describe("Cloudinary webhook handler", () => {
  it("accepts valid webhook payloads", async () => {
    const queue: Pick<MediaQueueController, "enqueueWebhookEvent"> = {
      enqueueWebhookEvent: jest.fn().mockResolvedValue({ jobId: "job-123" }),
    };

    const config = createTestConfig({
      media: {
        cloudinary: {
          webhook: {
            signingSecret: SIGNING_SECRET,
          },
        },
      },
    });

    const handler = createCloudinaryWebhookHandler(config, {
      queue: queue as MediaQueueController,
    });

    const payload = {
      notification_type: "upload",
      notification_id: "evt_123",
      public_id: "sample-public-id",
    };

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = buildSignature(payload, timestamp);

    await request(createApp(handler))
      .post("/webhooks/cloudinary")
      .set("X-Cld-Timestamp", timestamp)
      .set("X-Cld-Signature", signature)
      .send(payload)
      .expect(202);

    expect(queue.enqueueWebhookEvent).toHaveBeenCalledWith({
      event: expect.objectContaining({
        id: "evt_123",
        type: "upload",
        payload: expect.objectContaining({
          public_id: "sample-public-id",
        }),
      }),
    });
  });

  it("rejects payloads with invalid signatures", async () => {
    const queue: Pick<MediaQueueController, "enqueueWebhookEvent"> = {
      enqueueWebhookEvent: jest.fn().mockResolvedValue({ jobId: "job-123" }),
    };
    const config = createTestConfig({
      media: {
        cloudinary: {
          webhook: {
            signingSecret: SIGNING_SECRET,
          },
        },
      },
    });
    const handler = createCloudinaryWebhookHandler(config, {
      queue: queue as MediaQueueController,
    });

    const payload = {
      notification_type: "delete",
      notification_id: "evt-invalid",
    };

    await request(createApp(handler))
      .post("/webhooks/cloudinary")
      .set("X-Cld-Timestamp", `${Math.floor(Date.now() / 1000)}`)
      .set("X-Cld-Signature", "invalid-signature")
      .send(payload)
      .expect(401);

    expect(queue.enqueueWebhookEvent).not.toHaveBeenCalled();
  });

  it("rejects stale timestamps", async () => {
    const queue: Pick<MediaQueueController, "enqueueWebhookEvent"> = {
      enqueueWebhookEvent: jest.fn().mockResolvedValue({ jobId: "job-123" }),
    };
    const config = createTestConfig({
      media: {
        cloudinary: {
          webhook: {
            signingSecret: SIGNING_SECRET,
          },
        },
      },
    });
    const handler = createCloudinaryWebhookHandler(config, {
      queue: queue as MediaQueueController,
      timestampToleranceSeconds: 60,
    });

    const payload = {
      notification_type: "upload",
      notification_id: "evt_stale",
    };

    const timestamp = "1";
    const signature = buildSignature(payload, timestamp);

    await request(createApp(handler))
      .post("/webhooks/cloudinary")
      .set("X-Cld-Timestamp", timestamp)
      .set("X-Cld-Signature", signature)
      .send(payload)
      .expect(401);

    expect(queue.enqueueWebhookEvent).not.toHaveBeenCalled();
  });
});
