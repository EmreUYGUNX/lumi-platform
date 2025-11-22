import { sessionStore } from "@/store/session";
import { toast } from "@/hooks/use-toast";

import { addAuthBreadcrumb } from "./metrics";

export interface LoginContext {
  fingerprint?: string | null;
  locationHint?: string;
  attempts?: number;
}

export const evaluateLoginRisk = (context: LoginContext): string[] => {
  const reasons: string[] = [];
  const state = sessionStore.getState();
  const knownDevice = context.fingerprint
    ? state.trustedDevices.some((device) => device.id === context.fingerprint)
    : false;

  if (context.fingerprint && !knownDevice) {
    reasons.push("Yeni cihaz algılandı");
  }

  const hour = new Date().getHours();
  if (hour < 6 || hour > 23) {
    reasons.push("Alışılmadık giriş zamanı");
  }

  if ((context.attempts ?? 0) > 3) {
    reasons.push("Çoklu başarısız deneme");
  }

  return reasons;
};

export const alertSuspiciousLogin = (reasons: string[]): void => {
  if (reasons.length === 0) return;
  addAuthBreadcrumb("suspicious.login", { reasons });
  toast({
    title: "Olağandışı giriş uyarısı",
    description: reasons.join(" • "),
    variant: "destructive",
  });
};
