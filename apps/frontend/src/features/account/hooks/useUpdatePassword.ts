"use client";

import { useMutation } from "@tanstack/react-query";

import { authApi } from "@/lib/auth/api";
import { logAuditEvent } from "@/lib/auth/audit";
import { ApiClientError } from "@/lib/api-client";
import { toast } from "@/hooks/use-toast";

interface UpdatePasswordInput {
  currentPassword: string;
  newPassword: string;
  forceLogoutAll?: boolean;
}

export const useUpdatePassword = () => {
  return useMutation({
    mutationKey: ["account", "password", "update"],
    mutationFn: async (payload: UpdatePasswordInput) => {
      return authApi.updatePassword({
        currentPassword: payload.currentPassword,
        newPassword: payload.newPassword,
      });
    },
    onSuccess: (_response, variables) => {
      if (variables.forceLogoutAll) {
        toast({
          title: "Tüm oturumlar kapatılıyor",
          description: "Güvenlik için tekrar giriş yapmanız istenecek.",
        });
      } else {
        toast({ title: "Şifre güncellendi" });
      }
      logAuditEvent("password_change");
    },
    onError: (error) => {
      const description = error instanceof ApiClientError ? error.message : "Şifre güncellenemedi.";
      toast({ title: "İşlem başarısız", description, variant: "destructive" });
    },
  });
};
