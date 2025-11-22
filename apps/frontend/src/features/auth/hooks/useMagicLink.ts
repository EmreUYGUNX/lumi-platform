"use client";

import { useMutation } from "@tanstack/react-query";

import { authApi } from "@/lib/auth/api";
import { ApiClientError } from "@/lib/api-client";
import { toast } from "@/hooks/use-toast";

import type { MagicLinkFormValues } from "../schemas/magic-link.schema";

export const useMagicLink = () => {
  return useMutation({
    mutationKey: ["auth", "magic-link"],
    mutationFn: (payload: MagicLinkFormValues) =>
      authApi.magicLink({
        email: payload.email,
      }),
    onSuccess: (_, variables) => {
      toast({
        title: "Giriş bağlantısı gönderildi",
        description: `${variables.email} adresine sihirli bağlantı ulaştı (varsa spam'i kontrol et).`,
      });
    },
    onError: (error) => {
      let description = "Bağlantı gönderilemedi. Lütfen tekrar deneyin.";
      if (error instanceof ApiClientError) {
        description = error.message;
      }
      toast({
        title: "İşlem başarısız",
        description,
        variant: "destructive",
      });
    },
  });
};
