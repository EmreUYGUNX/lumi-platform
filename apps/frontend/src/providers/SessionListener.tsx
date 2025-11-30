"use client";

/* eslint-disable unicorn/no-null */

import { useEffect, useRef, type MutableRefObject } from "react";

import type { SessionBroadcastEvent } from "@/lib/auth/session";
import { setSentryUser } from "@/lib/analytics/sentry";
import { broadcastSessionEvent } from "@/lib/auth/session";
import { sessionStore } from "@/store/session";

const CHANNEL_NAME = "lumi-session";
const STORAGE_EVENT_KEY = "lumi-session-event";

const toDateOrNull = (value?: string | null): Date | null => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const buildSnapshot = () => {
  const state = sessionStore.getState();
  return {
    user: state.user ?? undefined,
    accessToken: state.accessToken,
    sessionId: state.sessionId,
    sessionExpiry: state.sessionExpiry ? state.sessionExpiry.toISOString() : null,
    deviceFingerprint: state.deviceFingerprint,
    trustedDevices: state.trustedDevices,
    roles: state.roles,
    permissions: state.permissions,
  };
};

const createChannel = (): BroadcastChannel | undefined => {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    return undefined;
  }
  return new BroadcastChannel(CHANNEL_NAME);
};

const applyRemoteSession = (payload: SessionBroadcastEvent["payload"]): void => {
  if (!payload?.user) {
    return;
  }
  sessionStore.getState().setSession({
    user: payload.user,
    accessToken: payload.accessToken,
    sessionId: payload.sessionId,
    sessionExpiry: toDateOrNull(payload.sessionExpiry),
    deviceFingerprint: payload.deviceFingerprint ?? null,
    trustedDevices: payload.trustedDevices,
    roles: payload.roles,
    permissions: payload.permissions,
  });
};

const handleMessageEvent = (
  data: SessionBroadcastEvent | undefined,
  isSyncing: MutableRefObject<boolean>,
): void => {
  if (!data) {
    return;
  }

  // eslint-disable-next-line no-param-reassign
  isSyncing.current = true;
  switch (data.type) {
    case "logout": {
      sessionStore.getState().clearSession();
      break;
    }
    case "login": {
      applyRemoteSession(data.payload);
      break;
    }
    case "refresh": {
      applyRemoteSession(data.payload);
      break;
    }
    case "session-update": {
      applyRemoteSession(data.payload);
      break;
    }
    default: {
      break;
    }
  }
  // eslint-disable-next-line no-param-reassign
  isSyncing.current = false;
};

const parseStorageEvent = (event: StorageEvent): SessionBroadcastEvent | undefined => {
  if (event.key !== STORAGE_EVENT_KEY || !event.newValue) {
    return undefined;
  }

  try {
    return JSON.parse(event.newValue) as SessionBroadcastEvent;
  } catch {
    return undefined;
  }
};

const handleSentryScope = (): void => {
  if (typeof window === "undefined") {
    return;
  }
  const { user: currentUser } = sessionStore.getState();
  setSentryUser(currentUser);
  const sentry = (
    window as { Sentry?: { setUser?: (user: { id: string; email: string } | null) => void } }
  ).Sentry;
  if (!sentry?.setUser) {
    return;
  }

  if (currentUser) {
    sentry.setUser({ id: currentUser.id, email: currentUser.email });
  } else {
    sentry.setUser(null);
  }
};

const SessionListener = (): JSX.Element => {
  const isSyncing = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return () => {};
    }

    const channel = createChannel();

    const onMessage = (event: MessageEvent<SessionBroadcastEvent>) =>
      handleMessageEvent(event.data, isSyncing);

    const onStorage = (event: StorageEvent) => {
      const parsed = parseStorageEvent(event);
      if (!parsed) {
        return;
      }
      onMessage(new MessageEvent<SessionBroadcastEvent>("message", { data: parsed }));
    };

    channel?.addEventListener("message", onMessage);
    window.addEventListener("storage", onStorage);

    const unsubscribe = sessionStore.subscribe((state, prev) => {
      if (isSyncing.current) {
        return;
      }

      if (!prev.isAuthenticated && state.isAuthenticated) {
        broadcastSessionEvent({ type: "login", payload: buildSnapshot() });
      } else if (prev.isAuthenticated && !state.isAuthenticated) {
        broadcastSessionEvent({ type: "logout" });
      } else if (state.accessToken && state.accessToken !== prev.accessToken) {
        broadcastSessionEvent({ type: "refresh", payload: buildSnapshot() });
      } else if (state.sessionExpiry?.toISOString() !== prev.sessionExpiry?.toISOString()) {
        broadcastSessionEvent({ type: "session-update", payload: buildSnapshot() });
      }
    });

    const sentryUnsub = sessionStore.subscribe(handleSentryScope);
    handleSentryScope();

    return () => {
      unsubscribe();
      sentryUnsub();
      channel?.removeEventListener("message", onMessage);
      channel?.close();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return <></>;
};

export default SessionListener;
