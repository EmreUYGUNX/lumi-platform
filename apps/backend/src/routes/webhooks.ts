import { Router } from "express";

import type { MediaQueueController } from "@/queues/media.queue.js";
import { getMediaQueueController } from "@/queues/media.queue.js";
import { createCloudinaryWebhookHandler } from "@/webhooks/cloudinary.webhook.js";
import type { ApplicationConfig } from "@lumi/types";

type RouteRegistrar = (method: string, path: string) => void;

export interface WebhookRouterOptions {
  registerRoute?: RouteRegistrar;
  queue?: MediaQueueController;
}

export const createWebhookRouter = (
  config: ApplicationConfig,
  options: WebhookRouterOptions = {},
) => {
  const router = Router();
  const queue = options.queue ?? getMediaQueueController(config);
  const handler = createCloudinaryWebhookHandler(config, { queue });

  router.post("/cloudinary", handler);
  options.registerRoute?.("POST", "/cloudinary");

  return router;
};
