"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";

import { broadcastSessionEvent, cancelRefresh, scheduleRefresh } from "@/lib/auth/session";
import SessionListener from "@/providers/SessionListener";
import { sessionStore } from "@/store/session";

interface SessionContextValue {
  idleWarning: boolean;
  isIdle: boolean;
  lastActivity: number;
  resetIdle: () => void;
}

const SessionContext = createContext<SessionContextValue>({
  idleWarning: false,
  isIdle: false,
  lastActivity: Date.now(),
  resetIdle: () => {},
});

const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const IDLE_WARNING_MS = 13 * 60 * 1000;
const ACTIVITY_EVENTS: (keyof DocumentEventMap)[] = [
  "click",
  "keypress",
  "scroll",
  "mousemove",
  "visibilitychange",
];

export const SessionProvider = ({ children }: PropsWithChildren): JSX.Element => {
  const [idleWarning, setIdleWarning] = useState(false);
  const [isIdle, setIsIdle] = useState(false);
  const [lastActivity, setLastActivity] = useState<number>(Date.now());
  const warningTimer = useRef<ReturnType<typeof setTimeout>>();
  const logoutTimer = useRef<ReturnType<typeof setTimeout>>();
  const hydratedRef = useRef(false);

  const { sessionExpiry, isAuthenticated } = sessionStore((state) => ({
    sessionExpiry: state.sessionExpiry,
    isAuthenticated: state.isAuthenticated,
  }));

  const clearTimers = useCallback(() => {
    if (warningTimer.current) {
      clearTimeout(warningTimer.current);
      warningTimer.current = undefined;
    }
    if (logoutTimer.current) {
      clearTimeout(logoutTimer.current);
      logoutTimer.current = undefined;
    }
  }, []);

  const markActivity = useCallback(() => {
    setLastActivity(Date.now());
    setIdleWarning(false);
    setIsIdle(false);
    clearTimers();
  }, [clearTimers]);

  const scheduleIdleChecks = useCallback(() => {
    clearTimers();
    const now = Date.now();
    const elapsed = now - lastActivity;
    const warnIn = Math.max(0, IDLE_WARNING_MS - elapsed);
    const logoutIn = Math.max(0, IDLE_TIMEOUT_MS - elapsed);

    warningTimer.current = setTimeout(() => {
      setIdleWarning(true);
    }, warnIn);

    logoutTimer.current = setTimeout(() => {
      setIsIdle(true);
      setIdleWarning(false);
      sessionStore.getState().clearSession();
      broadcastSessionEvent({ type: "logout" });
    }, logoutIn);
  }, [clearTimers, lastActivity]);

  useEffect(() => {
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      sessionStore.persist?.rehydrate?.();
    }
  }, []);

  useEffect(() => {
    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, markActivity, { passive: true });
    });

    return () => {
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, markActivity);
      });
    };
  }, [markActivity]);

  useEffect(() => {
    scheduleIdleChecks();
    return clearTimers;
  }, [scheduleIdleChecks, clearTimers, lastActivity]);

  useEffect(() => {
    if (sessionExpiry && sessionExpiry.getTime() <= Date.now()) {
      sessionStore.getState().clearSession();
      broadcastSessionEvent({ type: "logout" });
      cancelRefresh();
      return () => {
        cancelRefresh();
      };
    }

    if (isAuthenticated) {
      scheduleRefresh(sessionExpiry);
    } else {
      cancelRefresh();
    }

    return () => {
      cancelRefresh();
    };
  }, [isAuthenticated, sessionExpiry]);

  const value = useMemo(
    () => ({
      idleWarning,
      isIdle,
      lastActivity,
      resetIdle: markActivity,
    }),
    [idleWarning, isIdle, lastActivity, markActivity],
  );

  return (
    <SessionContext.Provider value={value}>
      <SessionListener />
      {children}
    </SessionContext.Provider>
  );
};

export const useSessionContext = (): SessionContextValue => useContext(SessionContext);
