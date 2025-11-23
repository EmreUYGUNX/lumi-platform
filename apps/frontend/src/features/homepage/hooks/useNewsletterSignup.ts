"use client";

import { useMutation } from "@tanstack/react-query";
import { z } from "zod";

import { useToast } from "@/hooks/use-toast";
import { trackClientEvent } from "@/lib/analytics/tracking";

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, { message: "Geçerli bir e-posta girin" });

const sanitizeEmail = (email: string): string =>
  email
    .trim()
    .toLowerCase()
    .replaceAll(/\s+/g, "")
    .replaceAll(/[^\w+.@-]/g, "");

const subscribeRequest = async (email: string) => {
  const sanitized = sanitizeEmail(email);
  const parsed = emailSchema.parse(sanitized);

  const response = await fetch("/api/newsletter", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: parsed }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.message ?? "Abonelik sırasında bir hata oluştu");
  }

  return { email: parsed };
};

export const useNewsletterSignup = () => {
  const { toast } = useToast();

  return useMutation({
    mutationFn: subscribeRequest,
    onSuccess: ({ email }) => {
      trackClientEvent("newsletter_subscribed", { email });
      toast({
        title: "Abonelik tamamlandı",
        description: `${email} için güncellemeler gönderilecektir.`,
      });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Beklenmeyen bir hata oluştu";
      toast({
        title: "Abonelik başarısız",
        description: message,
        variant: "destructive",
      });
    },
  });
};
