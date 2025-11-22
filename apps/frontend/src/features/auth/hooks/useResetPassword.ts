"use client";

import { useMutation } from "@tanstack/react-query";

import { useRouter } from "next/navigation";

import { authApi } from "@/lib/auth/api";
import { trackPasswordReset } from "@/lib/auth/metrics";
import { ApiClientError } from "@/lib/api-client";
import { toast } from "@/hooks/use-toast";
import { logAuditEvent } from "@/lib/auth/audit";

import type { ResetPasswordFormValues } from "../schemas/password.schema";

export const useResetPassword = (token?: string) => {
  const router = useRouter();

  return useMutation({
    mutationKey: ["auth", "reset-password", token],
    mutationFn: async (payload: ResetPasswordFormValues) => {
      if (!token) {
        throw new ApiClientError({ code: "TOKEN_MISSING", message: "Geçersiz veya eksik token" });
      }
      return authApi.resetPassword({
        token,
        password: payload.password,
      });
    },
    onSuccess: () => {
      toast({
        title: "Şifre güncellendi",
        description: "Yeni şifren ile giriş yapabilirsin.",
      });
      trackPasswordReset(true);
      logAuditEvent("password_change");
      router.replace("/login");
    },
    onError: (error) => {
      let description = "Şifre sıfırlama başarısız. Linkin süresi dolmuş olabilir.";
      if (error instanceof ApiClientError) {
        description = error.message;
      }
      toast({
        title: "İşlem tamamlanamadı",
        description,
        variant: "destructive",
      });
      trackPasswordReset(false);
    },
  });
};
