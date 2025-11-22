"use client";

import { useMutation } from "@tanstack/react-query";

import { useRouter } from "next/navigation";

import { addAuthBreadcrumb, trackLogin } from "@/lib/auth/metrics";
import { authApi } from "@/lib/auth/api";
import {
  transformDeviceData,
  transformSessionData,
  resolveLocale,
  resolveTimeZone,
} from "@/lib/auth/transformers";
import { ApiClientError } from "@/lib/api-client";
import { ensureDeviceFingerprint, registerTrustedDevice } from "@/lib/auth/device";
import { alertSuspiciousLogin, evaluateLoginRisk } from "@/lib/auth/suspicious";
import { logAuditEvent } from "@/lib/auth/audit";
import { sessionStore } from "@/store/session";
import { toast } from "@/hooks/use-toast";

import type { LoginFormValues } from "../schemas/login.schema";

export const useLogin = () => {
  const router = useRouter();
  let startedAt = Date.now();

  return useMutation({
    mutationKey: ["auth", "login"],
    mutationFn: async (payload: LoginFormValues) => {
      startedAt = Date.now();
      const device = transformDeviceData();
      const fingerprint = await ensureDeviceFingerprint();
      const response = await authApi.login({
        email: payload.email,
        password: payload.password,
        rememberMe: payload.rememberMe,
        context: {
          locale: resolveLocale(),
          timeZone: resolveTimeZone(),
          userAgent: device.userAgent,
          fingerprint: fingerprint ?? undefined,
        },
      });
      return transformSessionData(response.data);
    },
    onMutate: () => {
      sessionStore.getState().startAuthentication();
      addAuthBreadcrumb("auth.login.attempt");
    },
    onSuccess: async (session) => {
      sessionStore.getState().setSession({
        user: session.user,
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        sessionId: session.sessionId,
        sessionExpiry: session.refreshTokenExpiresAt,
        roles: session.user.roles,
        permissions: session.user.permissions,
        featureFlags: sessionStore.getState().featureFlags,
      });
      await registerTrustedDevice("Current device");

      trackLogin(true, "password", Date.now() - startedAt);
      logAuditEvent("login");
      const reasons = evaluateLoginRisk({ fingerprint: sessionStore.getState().deviceFingerprint });
      alertSuspiciousLogin(reasons);

      router.replace("/dashboard");
    },
    onError: (error) => {
      let description = "Giriş başarısız. Bilgilerinizi kontrol edin.";
      if (error instanceof ApiClientError) {
        description = error.message;
      }
      toast({
        title: "Oturum açılamadı",
        description,
        variant: "destructive",
      });
      sessionStore.getState().clearSession();
      trackLogin(false, "password");
      logAuditEvent("login_failed", { error: (error as Error)?.message });
    },
  });
};
