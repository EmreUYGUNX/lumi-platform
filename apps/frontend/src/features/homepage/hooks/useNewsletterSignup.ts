"use client";

import { useMutation } from "@tanstack/react-query";
import { z } from "zod";

import { apiClient } from "@/lib/api-client";

export const newsletterPayloadSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Geçerli bir e-posta adresi girin.")
    .transform((value) => value.toLowerCase()),
});

const responseSchema = z
  .object({
    subscribed: z.boolean().default(true),
    message: z.string().optional(),
  })
  .strict();

type NewsletterPayload = z.infer<typeof newsletterPayloadSchema>;
type NewsletterResponse = z.infer<typeof responseSchema>;

const maskEmail = (email: string): string => {
  const [localRaw = "", domain] = email.split("@");
  if (!domain) return email;
  const local = localRaw || "user";

  const prefix = local.slice(0, 2);
  return `${prefix}${local.length > 2 ? "***" : "*"}@${domain}`;
};

const emitMarketingEvent = (event: string, payload?: Record<string, unknown>) => {
  if (typeof window === "undefined") return;

  try {
    const { posthog } = window as {
      posthog?: { capture?: (e: string, p?: Record<string, unknown>) => void };
    };
    posthog?.capture?.(event, payload);

    const { amplitude } = window as {
      amplitude?: {
        getInstance?: () => { logEvent?: (e: string, p?: Record<string, unknown>) => void };
      };
    };
    amplitude?.getInstance?.()?.logEvent?.(event, payload);

    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console -- surfaced only in development for observability
      console.info(`[marketing] ${event}`, payload);
    }
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console -- surfaced only in development for observability
      console.warn("[marketing] analytics emit failed", error);
    }
  }
};

export const useNewsletterSignup = () =>
  useMutation<NewsletterResponse, Error, NewsletterPayload>({
    mutationKey: ["newsletter", "signup"],
    mutationFn: async (input) => {
      const parsed = newsletterPayloadSchema.parse(input);
      const response = await apiClient.post("/marketing/newsletter/subscribe", {
        body: parsed,
        dataSchema: responseSchema,
        retry: 1,
      });

      emitMarketingEvent("marketing.newsletter.subscribe.success", {
        email: maskEmail(parsed.email),
        channel: "storefront",
      });

      return response.data;
    },
    onError: (error, variables) => {
      const parsed = newsletterPayloadSchema.safeParse(variables);
      const sanitized = parsed.success ? parsed.data.email : variables?.email;
      emitMarketingEvent("marketing.newsletter.subscribe.error", {
        email: sanitized ? maskEmail(sanitized) : undefined,
        reason: error instanceof Error ? error.message : "unknown",
        channel: "storefront",
      });
    },
  });
