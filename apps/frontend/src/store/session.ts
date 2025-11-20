/* eslint-disable unicorn/no-null */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { LumiUser } from "@/lib/session";
import { resolvePreviewUser } from "@/lib/session";

const SESSION_STORAGE_KEY = "lumi.session";
const PREFERENCES_STORAGE_KEY = "lumi.preferences";

const createStorage = (): Storage => {
  if (typeof window === "undefined") {
    const store = new Map<string, string>();
    return {
      get length() {
        return store.size;
      },
      clear: () => {
        store.clear();
      },
      getItem: (key: string) =>
        // eslint-disable-next-line security/detect-object-injection
        store.get(key) ?? null,
      key: (index: number) => {
        if (!Number.isInteger(index) || index < 0) {
          return null;
        }
        const keys = [...store.keys()];
        // eslint-disable-next-line security/detect-object-injection
        return keys[index] ?? null;
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    };
  }

  return window.sessionStorage;
};

export type ThemePreference = "light" | "dark" | "system";
export interface SessionPreferences {
  theme: ThemePreference;
  locale: string;
  marketingEmails: boolean;
  betaFeatures: boolean;
  sidebarPinned: boolean;
}

const DEFAULT_PREFERENCES: SessionPreferences = {
  theme: "system",
  locale: "tr-TR",
  marketingEmails: false,
  betaFeatures: false,
  sidebarPinned: true,
};

const readPreferences = (): SessionPreferences => {
  if (typeof window === "undefined") {
    return DEFAULT_PREFERENCES;
  }

  try {
    const rawValue = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!rawValue) {
      return DEFAULT_PREFERENCES;
    }
    const parsed = JSON.parse(rawValue) as Partial<SessionPreferences>;
    return { ...DEFAULT_PREFERENCES, ...parsed };
  } catch {
    return DEFAULT_PREFERENCES;
  }
};

const persistPreferences = (preferences: SessionPreferences): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Failing to persist preferences should never block UI flows.
  }
};

export type SessionStatus = "anonymous" | "authenticating" | "authenticated";

export interface SessionState {
  status: SessionStatus;
  user?: LumiUser;
  accessToken?: string;
  refreshToken?: string;
  roles: string[];
  permissions: Record<string, boolean>;
  featureFlags: Record<string, boolean>;
  lastAuthenticatedAt?: number;
  impersonatorId?: string;
  preferences: SessionPreferences;
}

export interface SessionActions {
  startAuthentication: () => void;
  login: (payload: {
    user: LumiUser;
    accessToken?: string;
    refreshToken?: string;
    featureFlags?: Record<string, boolean>;
    permissions?: Record<string, boolean>;
  }) => void;
  logout: () => void;
  updateUser: (partial: Partial<LumiUser>) => void;
  setFeatureFlags: (flags: Record<string, boolean>) => void;
  toggleFeatureFlag: (flag: string, enabled: boolean) => void;
  updatePreferences: (preferences: Partial<SessionPreferences>) => void;
  hydratePreviewUser: () => void;
  setAuthToken: (token?: string) => void;
}

export type SessionStore = SessionState & SessionActions;

const preferencesFromStorage = readPreferences();

const rehydratePreferences = (state?: SessionStore) => {
  if (!state) {
    return;
  }
  // eslint-disable-next-line no-param-reassign
  state.preferences = readPreferences();
};

export const useSessionStore = create<SessionStore>()(
  persist(
    (set) => ({
      status: "anonymous",
      user: undefined,
      accessToken: undefined,
      refreshToken: undefined,
      roles: [],
      permissions: {},
      featureFlags: {},
      lastAuthenticatedAt: undefined,
      impersonatorId: undefined,
      preferences: preferencesFromStorage,
      startAuthentication: () => {
        set((state) => ({
          ...state,
          status: "authenticating",
        }));
      },
      login: ({ user, accessToken, refreshToken, featureFlags, permissions }) => {
        set((state) => ({
          ...state,
          status: "authenticated",
          user,
          roles: user.roles,
          permissions: permissions ?? state.permissions,
          accessToken: accessToken ?? state.accessToken,
          refreshToken: refreshToken ?? state.refreshToken,
          featureFlags: featureFlags
            ? { ...state.featureFlags, ...featureFlags }
            : state.featureFlags,
          lastAuthenticatedAt: Date.now(),
        }));
      },
      logout: () => {
        set((state) => ({
          ...state,
          status: "anonymous",
          user: undefined,
          accessToken: undefined,
          refreshToken: undefined,
          featureFlags: {},
          roles: [],
          permissions: {},
          impersonatorId: undefined,
          lastAuthenticatedAt: undefined,
        }));
      },
      updateUser: (partial) => {
        set((state) => {
          const nextUser = { ...(state.user ?? resolvePreviewUser()), ...partial };
          return {
            ...state,
            user: nextUser,
            roles: nextUser.roles,
          };
        });
      },
      setFeatureFlags: (flags) => {
        set((state) => ({
          ...state,
          featureFlags: { ...state.featureFlags, ...flags },
        }));
      },
      toggleFeatureFlag: (flag, enabled) => {
        const sanitizedFlag = String(flag);
        set((state) => ({
          ...state,
          featureFlags: { ...state.featureFlags, [sanitizedFlag]: enabled },
        }));
      },
      updatePreferences: (partial) => {
        set((state) => {
          const nextPreferences = { ...state.preferences, ...partial };
          persistPreferences(nextPreferences);
          return {
            ...state,
            preferences: nextPreferences,
          };
        });
      },
      hydratePreviewUser: () => {
        const preview = resolvePreviewUser();
        set((state) => ({
          ...state,
          user: preview,
          roles: preview.roles,
          status: "authenticated",
        }));
      },
      setAuthToken: (token) => {
        set((state) => ({
          ...state,
          accessToken: token,
        }));
      },
    }),
    {
      name: SESSION_STORAGE_KEY,
      storage: createJSONStorage(createStorage),
      partialize: (state) => ({
        status: state.status,
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        featureFlags: state.featureFlags,
        roles: state.roles,
        permissions: state.permissions,
        lastAuthenticatedAt: state.lastAuthenticatedAt,
      }),
      onRehydrateStorage: () => rehydratePreferences,
    },
  ),
);

export const sessionStore = useSessionStore;
