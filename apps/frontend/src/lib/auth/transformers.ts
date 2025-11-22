import type { SessionData, UserProfile } from "./contracts";

export interface TransformedUserProfile {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  fullName: string;
  phone?: string;
  emailVerified: boolean;
  status: UserProfile["status"];
  roles: string[];
  permissions: string[];
}

export interface TransformedSessionData {
  sessionId: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
  user: TransformedUserProfile;
  emailVerified: boolean;
}

export interface DeviceData {
  userAgent?: string;
  language: string;
  timeZone: string;
  platform?: string;
}

const toDateOrThrow = (value: string): Date => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new TypeError(`Invalid ISO date: ${value}`);
  }
  return parsed;
};

const resolveUserAgent = (fallback?: string): string | undefined => {
  if (fallback) {
    return fallback;
  }
  if (typeof navigator !== "undefined") {
    return navigator.userAgent;
  }
  return undefined;
};

export const resolveTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
  } catch {
    return "UTC";
  }
};

export const resolveLocale = (fallback = "en-US"): string => {
  if (typeof navigator !== "undefined" && navigator.language) {
    return navigator.language;
  }
  return fallback;
};

export const transformUserProfile = (profile: UserProfile): TransformedUserProfile => {
  const nameParts = [profile.firstName, profile.lastName].filter(Boolean);
  const fullName = nameParts.join(" ").trim() || profile.email;

  return {
    id: profile.id,
    email: profile.email,
    firstName: profile.firstName ?? undefined,
    lastName: profile.lastName ?? undefined,
    fullName,
    phone: profile.phone ?? undefined,
    emailVerified: profile.emailVerified,
    status: profile.status,
    roles: [...profile.roles],
    permissions: [...profile.permissions],
  };
};

export const transformSessionData = (payload: SessionData): TransformedSessionData => ({
  sessionId: payload.sessionId,
  accessToken: payload.accessToken,
  refreshToken: payload.refreshToken,
  accessTokenExpiresAt: toDateOrThrow(payload.accessTokenExpiresAt),
  refreshTokenExpiresAt: toDateOrThrow(payload.refreshTokenExpiresAt),
  user: transformUserProfile(payload.user),
  emailVerified: payload.emailVerified ?? payload.user.emailVerified,
});

export const transformDeviceData = (userAgent?: string): DeviceData => ({
  userAgent: resolveUserAgent(userAgent),
  language: resolveLocale(),
  timeZone: resolveTimeZone(),
  platform: typeof navigator === "undefined" ? undefined : navigator.platform,
});
