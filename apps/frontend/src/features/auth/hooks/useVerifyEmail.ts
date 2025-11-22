"use client";

import { useMutation } from "@tanstack/react-query";

import { useRouter } from "next/navigation";

import { authApi } from "@/lib/auth/api";
import { trackEmailVerification } from "@/lib/auth/metrics";
import { ApiClientError } from "@/lib/api-client";
import { toast } from "@/hooks/use-toast";
import { sessionStore } from "@/store/session";
import { logAuditEvent } from "@/lib/auth/audit";

import type { VerifyEmailFormValues } from "../schemas/verify-email.schema";

export const useVerifyEmail = () => {
  const router = useRouter();

  return useMutation({
    mutationKey: ["auth", "verify-email"],
    mutationFn: async (payload: VerifyEmailFormValues) => {
      return authApi.verifyEmail({
        token: payload.token,
      });
    },
    onSuccess: (response) => {
      const { user } = response.data;
      sessionStore.getState().updateUser({
        ...user,
        emailVerified: true,
      });

      trackEmailVerification(true);
      logAuditEvent("email_change");

      toast({
        title: "E-posta doğrulandı",
        description: "Hesabın aktif hale getirildi.",
      });

      router.replace("/dashboard");
    },
    onError: (error) => {
      let description = "Doğrulama başarısız. Linkin süresi dolmuş olabilir.";
      if (error instanceof ApiClientError) {
        description =
          error.code === "ALREADY_VERIFIED" ? "E-posta zaten doğrulanmış." : error.message;
      }

      toast({
        title: "Doğrulama tamamlanamadı",
        description,
        variant: "destructive",
      });
      trackEmailVerification(false);
    },
  });
};
