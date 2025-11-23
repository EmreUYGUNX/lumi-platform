"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import type { Route } from "next";

import { usePathname, useRouter } from "next/navigation";

import { shouldEnforceGuards } from "@/lib/session";
import { sessionStore } from "@/store/session";

interface GuardProps {
  children: ReactNode;
  role?: string;
  redirectTo?: Route;
  fallback?: ReactNode;
}

const DefaultFallback = (): JSX.Element => (
  <div className="text-lumi-text-secondary bg-lumi-bg-secondary/60 border-lumi-border/60 my-8 flex items-center justify-center rounded-2xl border px-4 py-6 text-sm">
    Checking access...
  </div>
);

const normalizeRole = (role?: string): string | undefined =>
  role ? role.trim().toLowerCase() : undefined;

const Guard = ({ children, role, redirectTo = "/login", fallback }: GuardProps): JSX.Element => {
  const router = useRouter();
  const pathname = usePathname();
  const currentPath = pathname && pathname.startsWith("/") ? pathname : "/";
  const [allowed, setAllowed] = useState(!shouldEnforceGuards);

  const { status, roles } = sessionStore((state) => ({
    status: state.status,
    roles: state.roles.map((item) => item.toLowerCase()),
  }));

  const normalizedRole = useMemo(() => normalizeRole(role), [role]);
  const isLoading = status === "authenticating";
  const shouldGuard = shouldEnforceGuards;

  useEffect(() => {
    if (!shouldGuard) {
      setAllowed(true);
      return;
    }

    if (status === "authenticated") {
      if (normalizedRole && !roles.includes(normalizedRole)) {
        const forbidden = `/403?from=${encodeURIComponent(currentPath)}` as Route;
        router.replace(forbidden);
        return;
      }
      setAllowed(true);
      return;
    }

    if (status === "anonymous") {
      const target = `${redirectTo}?next=${encodeURIComponent(currentPath)}` as Route;
      router.replace(target);
    }
  }, [currentPath, normalizedRole, redirectTo, roles, router, shouldGuard, status]);

  if (!allowed || isLoading) {
    return fallback ? <>{fallback}</> : <DefaultFallback />;
  }

  return <>{children}</>;
};

export const RequireAuth = (props: Omit<GuardProps, "role">): JSX.Element => <Guard {...props} />;

export const RequireRole = ({ role, ...rest }: GuardProps): JSX.Element => (
  <Guard role={role} {...rest} />
);

export const requireAuth = (
  children: ReactNode,
  options?: Omit<GuardProps, "children" | "role">,
): JSX.Element => <RequireAuth {...options}>{children}</RequireAuth>;

export const requireRole = (
  role: string,
  children: ReactNode,
  options?: Omit<GuardProps, "children" | "role">,
): JSX.Element => (
  <RequireRole role={role} {...options}>
    {children}
  </RequireRole>
);
