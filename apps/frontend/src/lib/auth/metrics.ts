import { sessionStore } from "@/store/session";

type AnalyticsPayload = Record<string, unknown>;

const getDeviceInfo = ():
  | {
      userAgent: string;
      language: string;
      platform: string;
    }
  | undefined => {
  if (typeof navigator === "undefined") {
    return undefined;
  }
  return {
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
  };
};

const emit = (event: string, payload?: AnalyticsPayload): void => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    // PostHog
    const { posthog } = window as {
      posthog?: { capture?: (e: string, p?: AnalyticsPayload) => void };
    };
    posthog?.capture?.(event, payload);

    // Amplitude
    const { amplitude } = window as {
      amplitude?: {
        getInstance?: () => { logEvent?: (e: string, p?: AnalyticsPayload) => void };
      };
    };
    const amplitudeInstance = amplitude?.getInstance?.();
    amplitudeInstance?.logEvent?.(event, payload);

    if (process.env.NODE_ENV === "development") {
      console.info(`[auth-metrics] ${event}`, payload);
    }
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[auth-metrics] analytics emit failed", error);
    }
  }
};

const addBreadcrumb = (message: string, data?: AnalyticsPayload): void => {
  if (typeof window === "undefined") return;
  const sentry = (
    window as {
      Sentry?: {
        addBreadcrumb?: (c: { message: string; data?: unknown; category?: string }) => void;
      };
    }
  ).Sentry;
  sentry?.addBreadcrumb?.({ message, data, category: "auth" });
};

const baseDimensions = (extras?: AnalyticsPayload) => {
  const { roles } = sessionStore.getState();
  const device = getDeviceInfo();
  return {
    ...extras,
    role: roles[0] ?? "guest",
    device: device?.userAgent,
    language: device?.language,
    channel: "web",
  };
};

export const trackAuthEvent = (event: string, payload?: AnalyticsPayload): void =>
  emit(event, baseDimensions(payload));

export const trackLogin = (success: boolean, method: string, durationMs?: number): void => {
  const data = baseDimensions({ success, method, durationMs });
  emit("auth.login", data);
  addBreadcrumb("auth.login", data);
};

export const trackRegister = (success: boolean, method: string): void => {
  const data = baseDimensions({ success, method });
  emit("auth.register", data);
  addBreadcrumb("auth.register", data);
};

export const trackLogout = (reason: string): void => {
  const data = baseDimensions({ reason });
  emit("auth.logout", data);
  addBreadcrumb("auth.logout", data);
};

export const trackSessionRefresh = (success: boolean): void => {
  const data = baseDimensions({ success });
  emit("auth.session.refresh", data);
  addBreadcrumb("auth.session.refresh", data);
};

export const trackPasswordReset = (success: boolean): void => {
  const data = baseDimensions({ success });
  emit("auth.password.reset", data);
  addBreadcrumb("auth.password.reset", data);
};

export const trackEmailVerification = (success: boolean): void => {
  const data = baseDimensions({ success });
  emit("auth.email.verify", data);
  addBreadcrumb("auth.email.verify", data);
};

export const addAuthBreadcrumb = addBreadcrumb;
