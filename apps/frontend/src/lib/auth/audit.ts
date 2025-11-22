import { sessionStore } from "@/store/session";

export type AuditAction =
  | "login"
  | "login_failed"
  | "logout"
  | "password_change"
  | "email_change"
  | "profile_update"
  | "address_add"
  | "address_update"
  | "address_delete"
  | "session_revoke"
  | "session_revoke_all"
  | "twofactor_toggle"
  | "data_export"
  | "account_delete_request";

export interface AuditMetadata {
  ip?: string;
  userAgent?: string;
  deviceFingerprint?: string | null;
  [key: string]: unknown;
}

const AUDIT_STORAGE_KEY = "lumi.audit.log";

const readAuditLog = (): unknown[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(AUDIT_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as unknown[]) : [];
  } catch {
    return [];
  }
};

const writeAuditLog = (entries: unknown[]): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(entries.slice(-100)));
  } catch {
    // ignore
  }
};

export const logAuditEvent = (action: AuditAction, metadata: AuditMetadata = {}): void => {
  const state = sessionStore.getState();
  const entry = {
    action,
    userId: state.user?.id,
    roles: state.roles,
    timestamp: new Date().toISOString(),
    deviceFingerprint: state.deviceFingerprint,
    userAgent:
      metadata.userAgent ?? (typeof navigator === "undefined" ? undefined : navigator.userAgent),
    ip: metadata.ip,
    ...metadata,
  };

  const breadcrumbsTarget = (
    window as {
      Sentry?: {
        addBreadcrumb?: (crumb: { message: string; data?: unknown; category?: string }) => void;
      };
    }
  ).Sentry;
  breadcrumbsTarget?.addBreadcrumb?.({
    message: `audit.${action}`,
    data: entry,
    category: "audit",
  });

  const entries = readAuditLog();
  entries.push(entry);
  writeAuditLog(entries);

  if (process.env.NODE_ENV === "development") {
    console.info("[audit]", entry);
  }
};
