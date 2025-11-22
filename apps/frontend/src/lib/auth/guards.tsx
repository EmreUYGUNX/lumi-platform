"use client";

import type { ComponentType, FC, ReactNode } from "react";
import { useMemo } from "react";

import { usePathname, useRouter } from "next/navigation";

import { sessionStore } from "@/store/session";

const normalize = (value?: string): string | undefined =>
  value ? value.trim().toLowerCase() : undefined;

export const useAuth = () => {
  const session = sessionStore((state) => state);
  return useMemo(() => {
    const { isAuthenticated } = session;
    return {
      ...session,
      isAuthenticated,
    };
  }, [session]);
};

export const useRole = (role: string) => {
  const normalized = normalize(role);
  const roles = sessionStore((state) => state.roles.map((r) => normalize(r) ?? ""));
  return normalized ? roles.includes(normalized) : false;
};

export const usePermission = (permission: string) => {
  const normalized = normalize(permission);
  const permissions = sessionStore((state) =>
    state.permissions.map((entry) => normalize(entry) ?? ""),
  );
  return normalized ? permissions.includes(normalized) : false;
};

export const hasRole = (role: string): boolean => {
  const normalized = normalize(role);
  if (!normalized) {
    return false;
  }
  const roles = sessionStore.getState().roles.map((entry) => normalize(entry) ?? "");
  return roles.includes(normalized);
};

export const hasPermission = (permission: string): boolean => {
  const normalized = normalize(permission);
  if (!normalized) {
    return false;
  }
  const permissions = sessionStore.getState().permissions.map((entry) => normalize(entry) ?? "");
  return permissions.includes(normalized);
};

const GuardHOC = (check: () => boolean, redirectTo?: string) =>
  function withGuard<TProps extends object>(Component: ComponentType<TProps>): FC<TProps> {
    const Guarded: FC<TProps> = (props) => {
      const router = useRouter();
      const pathname = usePathname();
      const allowed = check();

      if (!allowed) {
        if (redirectTo) {
          router.replace(`${redirectTo}?next=${encodeURIComponent(pathname ?? "/")}`);
        }
        return <></>;
      }

      return <Component {...props} />;
    };

    Guarded.displayName = `Guarded(${Component.displayName ?? Component.name ?? "Component"})`;
    return Guarded;
  };

export const requireAuth = (redirectTo = "/login") =>
  GuardHOC(() => sessionStore.getState().isAuthenticated, redirectTo);

export const requireRole = (role: string, redirectTo = "/403") =>
  GuardHOC(() => {
    const normalized = normalize(role);
    return sessionStore
      .getState()
      .roles.map((r) => normalize(r))
      .includes(normalized);
  }, redirectTo);

export const requirePermission = (permission: string, redirectTo = "/403") =>
  GuardHOC(() => {
    const normalized = normalize(permission);
    const permissions = Object.keys(sessionStore.getState().permissions ?? {}).map((key) =>
      normalize(key),
    );
    return normalized ? permissions.includes(normalized) : false;
  }, redirectTo);

export const FeatureFlag = ({
  flag,
  fallback,
  children,
}: {
  flag: string;
  children: ReactNode;
  fallback?: ReactNode;
}): JSX.Element => {
  const { featureFlags } = sessionStore.getState();
  // eslint-disable-next-line security/detect-object-injection
  const isEnabled = Boolean(featureFlags?.[flag]);
  return isEnabled ? <>{children}</> : <>{fallback}</>;
};

export const RoleGuard = ({
  role,
  children,
  fallback,
}: {
  role: string;
  children: ReactNode;
  fallback?: ReactNode;
}): JSX.Element => {
  const allowed = useRole(role);
  return allowed ? <>{children}</> : <>{fallback}</>;
};

export const PermissionGuard = ({
  permission,
  children,
  fallback,
}: {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
}): JSX.Element => {
  const allowed = usePermission(permission);
  return allowed ? <>{children}</> : <>{fallback}</>;
};
