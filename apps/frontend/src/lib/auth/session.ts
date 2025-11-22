/* eslint-disable no-console */
/* eslint-disable unicorn/no-null */
import { sessionStore, type SessionUser, type TrustedDevice } from "@/store/session";

import { authApi } from "./api";
import { trackSessionRefresh } from "./metrics";
import { transformSessionData } from "./transformers";

const REFRESH_AHEAD_MS = 30 * 60 * 1000; // 30 minutes
const MAX_REFRESH_ATTEMPTS = 3;
const CHANNEL_NAME = "lumi-session";
const STORAGE_EVENT_KEY = "lumi-session-event";

interface SessionSyncPayload {
  user?: SessionUser;
  accessToken?: string;
  sessionId?: string;
  sessionExpiry?: string | null;
  deviceFingerprint?: string | null;
  trustedDevices?: TrustedDevice[];
  roles?: string[];
  permissions?: string[];
}

export type SessionBroadcastEvent =
  | { type: "login"; payload: SessionSyncPayload }
  | { type: "logout"; payload?: SessionSyncPayload }
  | { type: "refresh"; payload: SessionSyncPayload }
  | { type: "session-update"; payload: SessionSyncPayload };

let refreshTimeout: ReturnType<typeof setTimeout> | undefined;
let retryCount = 0;

const getBroadcastChannel = (): BroadcastChannel | null => {
  if (typeof window === "undefined") {
    return null;
  }
  if (typeof BroadcastChannel === "undefined") {
    return null;
  }
  return new BroadcastChannel(CHANNEL_NAME);
};

export const broadcastSessionEvent = (event: SessionBroadcastEvent): void => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const channel = getBroadcastChannel();
    channel?.postMessage(event);

    const payload = JSON.stringify({ ...event, ts: Date.now() });
    window.localStorage.setItem(STORAGE_EVENT_KEY, payload);
    window.localStorage.removeItem(STORAGE_EVENT_KEY);
  } catch (error) {
    console.warn("[session] Failed to broadcast session event", error);
  }
};

export const cancelRefresh = (): void => {
  if (refreshTimeout) {
    clearTimeout(refreshTimeout);
    refreshTimeout = undefined;
  }
  retryCount = 0;
};

export const scheduleRefresh = (expiry: Date | null | undefined): void => {
  cancelRefresh();

  if (!expiry) {
    return;
  }

  const delay = Math.max(0, expiry.getTime() - Date.now() - REFRESH_AHEAD_MS);
  refreshTimeout = setTimeout(() => {
    performRefresh().catch((error) => {
      console.warn("[session] refresh failed", error);
    });
  }, delay);
};

const applySession = (payload: ReturnType<typeof transformSessionData>): void => {
  sessionStore.getState().setSession({
    user: payload.user as SessionUser,
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    sessionId: payload.sessionId,
    sessionExpiry: payload.refreshTokenExpiresAt,
    roles: payload.user.roles,
    permissions: payload.user.permissions,
  });
};

export async function performRefresh(): Promise<void> {
  try {
    const response = await authApi.refreshToken();
    const payload = transformSessionData(response.data);
    applySession(payload);
    retryCount = 0;
    scheduleRefresh(payload.refreshTokenExpiresAt);
    broadcastSessionEvent({
      type: "refresh",
      payload: {
        user: payload.user as SessionUser,
        accessToken: payload.accessToken,
        sessionId: payload.sessionId,
        sessionExpiry: payload.refreshTokenExpiresAt.toISOString(),
        deviceFingerprint: sessionStore.getState().deviceFingerprint,
        trustedDevices: sessionStore.getState().trustedDevices,
        roles: payload.user.roles,
        permissions: payload.user.permissions,
      },
    });
    trackSessionRefresh(true);
  } catch {
    retryCount += 1;
    trackSessionRefresh(false);
    if (retryCount >= MAX_REFRESH_ATTEMPTS) {
      cancelRefresh();
      sessionStore.getState().clearSession();
      broadcastSessionEvent({ type: "logout" });
      trackSessionRefresh(false);
      return;
    }

    const backoff = Math.min(1000 * 2 ** (retryCount - 1), 5000);
    refreshTimeout = setTimeout(() => {
      performRefresh().catch((error) => {
        console.warn("[session] refresh retry failed", error);
      });
    }, backoff);
  }
}
