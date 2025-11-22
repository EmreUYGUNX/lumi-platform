"use client";

import { useMutation } from "@tanstack/react-query";

import { toast } from "@/hooks/use-toast";

import type { TwoFactorFormValues } from "../schemas/two-factor.schema";

export const useTwoFactor = () => {
  return useMutation({
    mutationKey: ["auth", "two-factor"],
    mutationFn: async (_payload: TwoFactorFormValues) => {
      throw new Error("2FA henüz etkin değil (Phase 16).");
    },
    onError: (error) => {
      toast({
        title: "2FA devre dışı",
        description:
          error instanceof Error ? error.message : "İki aşamalı doğrulama sonraki fazda açılacak.",
      });
    },
  });
};
