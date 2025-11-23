/* eslint-disable unicorn/no-null */
/* eslint-disable no-param-reassign */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

import type { UserProfile } from "@/lib/auth/contracts";
import type { LumiUser } from "@/lib/session";
import { resolvePreviewUser, shouldEnforceGuards } from "@/lib/session";

const SESSION_STORAGE_KEY = "lumi.session";
const PREFERENCES_STORAGE_KEY = "lumi.preferences";

const createMemoryStorage = (): Storage => {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => {
      store.clear();
    },
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => {
      if (!Number.isInteger(index) || index < 0) {
        return null;
      }
      // eslint-disable-next-line security/detect-object-injection
      return [...store.keys()][index] ?? null;
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
};

const createSessionStorage = (): Storage => {
  if (typeof window === "undefined") {
    return createMemoryStorage();
  }
  try {
    return window.sessionStorage;
  } catch {
    return createMemoryStorage();
  }
};

export type ThemePreference = "light" | "dark" | "system";
export interface SessionPreferences {
  theme: ThemePreference;
  locale: string;
  marketingEmails: boolean;
  betaFeatures: boolean;
  sidebarPinned: boolean;
}

export interface TrustedDevice {
  id: string;
  label?: string;
  lastUsedAt: string;
  platform?: string;
  userAgent?: string;
  ipAddress?: string;
  trusted?: boolean;
}

type Tier = "starter" | "growth" | "enterprise" | "unknown";

export type SessionUser = Omit<UserProfile, "roles" | "permissions"> &
  Partial<Omit<LumiUser, "roles">> & {
    roles: string[];
    permissions: string[];
    avatarUrl?: string;
    tier?: Tier;
    name?: string;
    fullName?: string;
  };

export type SessionStatus = "anonymous" | "authenticating" | "authenticated";

export interface SessionState {
  status: SessionStatus;
  isAuthenticated: boolean;
  user: SessionUser | null;
  accessToken?: string;
  refreshToken?: string;
  sessionId?: string;
  roles: string[];
  permissions: string[];
  featureFlags: Record<string, boolean>;
  sessionExpiry: Date | null;
  deviceFingerprint: string | null;
  trustedDevices: TrustedDevice[];
  lastAuthenticatedAt?: number;
  impersonatorId?: string;
  preferences: SessionPreferences;
}

export interface SessionActions {
  startAuthentication: () => void;
  setSession: (payload: {
    user: SessionUser;
    accessToken?: string;
    refreshToken?: string;
    sessionId?: string;
    sessionExpiry?: Date | string | number | null;
    roles?: string[];
    permissions?: string[];
    deviceFingerprint?: string | null;
    trustedDevices?: TrustedDevice[];
    featureFlags?: Record<string, boolean>;
  }) => void;
  clearSession: () => void;
  login: (payload: {
    user: SessionUser;
    accessToken?: string;
    refreshToken?: string;
    sessionId?: string;
    sessionExpiry?: Date | string | number | null;
    featureFlags?: Record<string, boolean>;
    permissions?: Record<string, boolean>;
  }) => void;
  logout: () => void;
  updateUser: (partial: Partial<SessionUser>) => void;
  setFeatureFlags: (flags: Record<string, boolean>) => void;
  toggleFeatureFlag: (flag: string, enabled: boolean) => void;
  updatePreferences: (preferences: Partial<SessionPreferences>) => void;
  hydratePreviewUser: () => void;
  setAuthToken: (token?: string) => void;
  addTrustedDevice: (device: TrustedDevice) => void;
  removeTrustedDevice: (deviceId: string) => void;
  setDeviceFingerprint: (fingerprint: string | null) => void;
}

export type SessionStore = SessionState & SessionActions;

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
    // Preferences persistence failures are non-blocking.
  }
};

const preferencesFromStorage = readPreferences();

const normaliseSessionExpiry = (value: Date | string | number | null | undefined): Date | null => {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const resolvePreviewProfile = (): SessionUser => {
  const preview = resolvePreviewUser();
  const [firstName, ...rest] = (preview.name ?? "").split(" ").filter(Boolean);
  const lastName = rest.join(" ") || undefined;

  return {
    id: preview.id,
    email: preview.email,
    firstName: firstName ?? preview.name ?? "Preview",
    lastName: lastName ?? "User",
    phone: undefined,
    emailVerified: true,
    status: "ACTIVE",
    roles: preview.roles,
    permissions: [],
    avatarUrl: preview.avatarUrl,
    tier: preview.tier ?? "enterprise",
    name: preview.name,
  };
};

const rehydratePreferences = (state?: SessionStore) => {
  if (!state) {
    return;
  }
  // eslint-disable-next-line no-param-reassign
  state.preferences = readPreferences();
};

const persistPartial = (state: SessionStore) => ({
  status: state.status,
  isAuthenticated: state.isAuthenticated,
  user: state.user,
  accessToken: state.accessToken,
  refreshToken: state.refreshToken,
  sessionId: state.sessionId,
  roles: state.roles,
  permissions: state.permissions,
  featureFlags: state.featureFlags,
  sessionExpiry: state.sessionExpiry ? state.sessionExpiry.toISOString() : null,
  deviceFingerprint: state.deviceFingerprint,
  trustedDevices: state.trustedDevices,
  lastAuthenticatedAt: state.lastAuthenticatedAt,
  impersonatorId: state.impersonatorId,
});

const rehydrateState = (state?: SessionStore) => {
  if (!state) {
    return;
  }
  if (typeof state.sessionExpiry === "string") {
    // eslint-disable-next-line no-param-reassign
    state.sessionExpiry = normaliseSessionExpiry(state.sessionExpiry);
  }
  rehydratePreferences(state as SessionStore);
};

export const useSessionStore = create<SessionStore>()(
  persist(
    immer((set, get) => ({
      status: "anonymous",
      isAuthenticated: false,
      user: null,
      accessToken: undefined,
      refreshToken: undefined,
      sessionId: undefined,
      roles: [],
      permissions: [],
      featureFlags: {},
      sessionExpiry: null,
      deviceFingerprint: null,
      trustedDevices: [],
      lastAuthenticatedAt: undefined,
      impersonatorId: undefined,
      preferences: preferencesFromStorage,
      startAuthentication: () => {
        set((state) => {
          state.status = "authenticating";
          state.isAuthenticated = false;
        });
      },
      setSession: ({
        user,
        accessToken,
        refreshToken,
        sessionId,
        sessionExpiry,
        roles,
        permissions,
        deviceFingerprint,
        trustedDevices,
        featureFlags,
      }) => {
        set((state) => {
          state.status = "authenticated";
          state.isAuthenticated = true;
          state.user = user;
          state.roles = roles ?? user.roles ?? state.roles;
          state.permissions = permissions ?? user.permissions ?? state.permissions;
          state.accessToken = accessToken ?? state.accessToken;
          state.refreshToken = refreshToken ?? state.refreshToken;
          state.sessionId = sessionId ?? state.sessionId;
          state.sessionExpiry = normaliseSessionExpiry(sessionExpiry) ?? state.sessionExpiry;
          state.deviceFingerprint = deviceFingerprint ?? state.deviceFingerprint;
          state.trustedDevices = trustedDevices ?? state.trustedDevices;
          state.featureFlags = featureFlags
            ? { ...state.featureFlags, ...featureFlags }
            : state.featureFlags;
          state.lastAuthenticatedAt = Date.now();
        });
      },
      clearSession: () => {
        set((state) => {
          state.status = "anonymous";
          state.isAuthenticated = false;
          state.user = null;
          state.roles = [];
          state.permissions = [];
          state.accessToken = undefined;
          state.refreshToken = undefined;
          state.sessionId = undefined;
          state.sessionExpiry = null;
          state.deviceFingerprint = null;
          state.trustedDevices = [];
          state.featureFlags = {};
          state.impersonatorId = undefined;
          state.lastAuthenticatedAt = undefined;
        });
      },
      login: (payload) => {
        const { user, accessToken, refreshToken, sessionId, sessionExpiry, featureFlags } = payload;
        set((state) => {
          state.status = "authenticated";
          state.isAuthenticated = true;
          state.user = user;
          state.roles = user.roles ?? state.roles;
          state.permissions = user.permissions ?? Object.keys(payload.permissions ?? {});
          state.accessToken = accessToken ?? state.accessToken;
          state.refreshToken = refreshToken ?? state.refreshToken;
          state.sessionId = sessionId ?? state.sessionId;
          state.sessionExpiry = normaliseSessionExpiry(sessionExpiry) ?? state.sessionExpiry;
          state.featureFlags = featureFlags
            ? { ...state.featureFlags, ...featureFlags }
            : state.featureFlags;
          state.lastAuthenticatedAt = Date.now();
        });
      },
      logout: () => {
        get().clearSession();
      },
      updateUser: (partial) => {
        set((state) => {
          const nextUser = state.user ? { ...state.user, ...partial } : partial;
          state.user = (nextUser as SessionUser) ?? state.user;
          state.roles = nextUser?.roles ?? state.roles;
          state.permissions = nextUser?.permissions ?? state.permissions;
        });
      },
      setFeatureFlags: (flags) => {
        set((state) => {
          state.featureFlags = { ...state.featureFlags, ...flags };
        });
      },
      toggleFeatureFlag: (flag, enabled) => {
        const sanitizedFlag = String(flag);
        set((state) => {
          state.featureFlags = { ...state.featureFlags, [sanitizedFlag]: enabled };
        });
      },
      updatePreferences: (partial) => {
        set((state) => {
          const nextPreferences = { ...state.preferences, ...partial };
          persistPreferences(nextPreferences);
          state.preferences = nextPreferences;
        });
      },
      hydratePreviewUser: () => {
        if (shouldEnforceGuards) {
          return;
        }
        const preview = resolvePreviewProfile();
        set((state) => {
          state.user = preview;
          state.roles = preview.roles;
          state.permissions = preview.permissions;
          state.status = "authenticated";
          state.isAuthenticated = true;
          state.sessionExpiry = new Date(Date.now() + 45 * 60 * 1000);
        });
      },
      setAuthToken: (token) => {
        set((state) => {
          state.accessToken = token ?? undefined;
        });
      },
      addTrustedDevice: (device) => {
        set((state) => {
          const exists = state.trustedDevices.some((entry) => entry.id === device.id);
          if (!exists) {
            state.trustedDevices.push(device);
          }
        });
      },
      removeTrustedDevice: (deviceId) => {
        set((state) => {
          state.trustedDevices = state.trustedDevices.filter((device) => device.id !== deviceId);
        });
      },
      setDeviceFingerprint: (fingerprint) => {
        set((state) => {
          state.deviceFingerprint = fingerprint ?? null;
        });
      },
    })),
    {
      name: SESSION_STORAGE_KEY,
      storage: createJSONStorage(createSessionStorage),
      partialize: persistPartial,
      onRehydrateStorage: () => rehydrateState,
    },
  ),
);

export const sessionStore = useSessionStore;
