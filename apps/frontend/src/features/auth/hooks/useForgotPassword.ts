"use client";

import { useMutation } from "@tanstack/react-query";

import { authApi } from "@/lib/auth/api";
import { ApiClientError } from "@/lib/api-client";
import { toast } from "@/hooks/use-toast";

import type { ForgotPasswordFormValues } from "../schemas/forgot-password.schema";

export const useForgotPassword = () => {
  return useMutation({
    mutationKey: ["auth", "forgot-password"],
    mutationFn: (payload: ForgotPasswordFormValues) =>
      authApi.forgotPassword({
        email: payload.email,
      }),
    onSuccess: (_, variables) => {
      toast({
        title: "E-posta gönderildi",
        description: `${variables.email} adresine talimatları gönderdik (eğer hesap varsa).`,
      });
    },
    onError: (error) => {
      let description = "Bir şeyler ters gitti. Lütfen tekrar deneyin.";
      if (error instanceof ApiClientError) {
        description = error.message;
      }

      toast({
        title: "Şifre sıfırlama başarısız",
        description,
        variant: "destructive",
      });
    },
  });
};
