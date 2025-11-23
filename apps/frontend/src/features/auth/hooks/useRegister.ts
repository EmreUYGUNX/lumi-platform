"use client";

import { useMutation } from "@tanstack/react-query";
import type { Route } from "next";

import { useRouter } from "next/navigation";

import { toast } from "@/hooks/use-toast";
import { authApi } from "@/lib/auth/api";
import { logAuditEvent } from "@/lib/auth/audit";
import { addAuthBreadcrumb, trackRegister } from "@/lib/auth/metrics";
import { ApiClientError } from "@/lib/api-client";

import type { RegisterFormValues } from "../schemas/register.schema";

const splitFullName = (fullName: string): { firstName: string; lastName: string } => {
  const [first, ...rest] = fullName.trim().split(" ").filter(Boolean);
  if (!first) {
    return { firstName: "User", lastName: "Lumi" };
  }
  if (rest.length === 0) {
    return { firstName: first, lastName: "Lumi" };
  }

  return { firstName: first, lastName: rest.join(" ") };
};

export const useRegister = () => {
  const router = useRouter();

  return useMutation({
    mutationKey: ["auth", "register"],
    mutationFn: async (payload: RegisterFormValues) => {
      const { firstName, lastName } = splitFullName(payload.fullName);
      return authApi.register({
        email: payload.email,
        password: payload.password,
        firstName,
        lastName,
        phone: undefined,
      });
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Hesap oluşturuldu",
        description: "E-postanı kontrol ederek doğrulamayı tamamla.",
      });

      trackRegister(true, "password");
      logAuditEvent("profile_update", { email: variables.email });

      const redirect = `/verify-email?email=${encodeURIComponent(variables.email)}` as Route;
      router.replace(redirect);
    },
    onError: (error) => {
      let description = "Kayıt işlemi başarısız. Lütfen tekrar deneyin.";
      if (error instanceof ApiClientError) {
        description =
          error.code === "USER_EXISTS" ? "Bu e-posta ile kayıtlı bir hesap mevcut." : error.message;
      }

      toast({
        title: "Kayıt tamamlanamadı",
        description,
        variant: "destructive",
      });
      trackRegister(false, "password");
    },
    onMutate: () => addAuthBreadcrumb("auth.register.attempt"),
  });
};
