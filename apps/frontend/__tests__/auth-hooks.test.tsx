import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { useForgotPassword } from "@/features/auth/hooks/useForgotPassword";
import { useLogin } from "@/features/auth/hooks/useLogin";
import { useRegister } from "@/features/auth/hooks/useRegister";
import { useResetPassword } from "@/features/auth/hooks/useResetPassword";
import { ApiClientError } from "@/lib/api-client";
import { sessionStore, type TrustedDevice } from "@/store/session";

vi.mock("@/lib/auth/api", () => ({
  authApi: {
    login: vi.fn(),
    register: vi.fn(),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
  },
}));

vi.mock("@/lib/auth/device", () => ({
  ensureDeviceFingerprint: vi.fn().mockResolvedValue("fp-123"),
  registerTrustedDevice: vi.fn().mockResolvedValue(undefined as unknown as TrustedDevice | null),
}));

vi.mock("@/lib/auth/metrics", () => ({
  trackLogin: vi.fn(),
  trackRegister: vi.fn(),
  trackPasswordReset: vi.fn(),
  trackEmailVerification: vi.fn(),
  trackSessionRefresh: vi.fn(),
  trackAuthEvent: vi.fn(),
  addAuthBreadcrumb: vi.fn(),
}));

vi.mock("@/lib/auth/suspicious", () => ({
  evaluateLoginRisk: () => [],
  alertSuspiciousLogin: () => {},
}));

const { authApi } = await import("@/lib/auth/api");

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

const buildSessionResponse = () => ({
  data: {
    sessionId: "00000000-0000-0000-0000-000000000001",
    accessToken: "access-token-12345",
    refreshToken: "refresh-token-12345",
    accessTokenExpiresAt: new Date(Date.now() + 1000 * 60 * 30).toISOString(),
    refreshTokenExpiresAt: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
    user: {
      id: "00000000-0000-0000-0000-000000000001",
      email: "demo@lumi.com",
      firstName: "Demo",
      lastName: "User",
      phone: "",
      emailVerified: true,
      status: "ACTIVE" as const,
      roles: ["customer"],
      permissions: ["read"],
    },
  },
  meta: {
    timestamp: new Date().toISOString(),
    requestId: "req-00000001",
  },
});

describe("auth hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStore.getState().clearSession();
  });

  it("logs in and updates session store", async () => {
    vi.mocked(authApi.login).mockResolvedValue(buildSessionResponse());
    const { result } = renderHook(() => useLogin(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        email: "demo@lumi.com",
        password: "Secret123!",
        rememberMe: true,
      });
    });

    await waitFor(() => {
      expect(sessionStore.getState().isAuthenticated).toBe(true);
      expect(sessionStore.getState().user?.email).toBe("demo@lumi.com");
    });
  });

  it("handles login error gracefully", async () => {
    vi.mocked(authApi.login).mockRejectedValue(
      new ApiClientError({ code: "UNAUTH", message: "Invalid credentials" }),
    );
    const { result } = renderHook(() => useLogin(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ email: "demo@lumi.com", password: "bad", rememberMe: false }),
      ).rejects.toThrowError(ApiClientError);
    });

    expect(sessionStore.getState().isAuthenticated).toBe(false);
  });

  it("handles network errors on login", async () => {
    vi.mocked(authApi.login).mockRejectedValue(new TypeError("Network down"));
    const { result } = renderHook(() => useLogin(), { wrapper });

    await expect(
      result.current.mutateAsync({
        email: "demo@lumi.com",
        password: "Secret123!",
        rememberMe: true,
      }),
    ).rejects.toThrow();

    expect(sessionStore.getState().isAuthenticated).toBe(false);
  });

  it("registers successfully", async () => {
    vi.mocked(authApi.register).mockResolvedValue({
      data: {
        user: {
          id: "00000000-0000-0000-0000-000000000002",
          email: "new@lumi.com",
          firstName: "New",
          lastName: "User",
          roles: ["customer"],
          permissions: ["read"],
          emailVerified: false,
          status: "ACTIVE",
        },
      },
    } as never);
    const { result } = renderHook(() => useRegister(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        fullName: "New User",
        email: "new@lumi.com",
        password: "VeryStrong123!",
        confirmPassword: "VeryStrong123!",
        acceptTerms: true,
        marketingConsent: false,
      });
    });

    expect(authApi.register).toHaveBeenCalledWith(
      expect.objectContaining({ email: "new@lumi.com", password: "VeryStrong123!" }),
    );
  });

  it("handles duplicate email on register", async () => {
    vi.mocked(authApi.register).mockRejectedValue(
      new ApiClientError({ code: "USER_EXISTS", message: "Already" }),
    );
    const { result } = renderHook(() => useRegister(), { wrapper });

    await expect(
      result.current.mutateAsync({
        fullName: "Dup User",
        email: "dup@lumi.com",
        password: "Strong123!",
        confirmPassword: "Strong123!",
        acceptTerms: true,
        marketingConsent: false,
      }),
    ).rejects.toThrow(ApiClientError);
  });

  it("handles validation error on register", async () => {
    vi.mocked(authApi.register).mockRejectedValue(
      new ApiClientError({ code: "VALIDATION", message: "Invalid payload" }),
    );
    const { result } = renderHook(() => useRegister(), { wrapper });

    await expect(
      result.current.mutateAsync({
        fullName: "Bad User",
        email: "bad@user",
        password: "short",
        confirmPassword: "short",
        acceptTerms: false,
        marketingConsent: false,
      }),
    ).rejects.toThrow(ApiClientError);
  });

  it("requests password reset email", async () => {
    vi.mocked(authApi.forgotPassword).mockResolvedValue({ data: { message: "ok" } } as never);
    const { result } = renderHook(() => useForgotPassword(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ email: "reset@lumi.com" });
    });
    expect(authApi.forgotPassword).toHaveBeenCalledWith({ email: "reset@lumi.com" });
  });

  it("resets password with token", async () => {
    vi.mocked(authApi.resetPassword).mockResolvedValue({
      data: {
        user: {
          id: "00000000-0000-0000-0000-000000000001",
          email: "demo@lumi.com",
          firstName: "Demo",
          lastName: "User",
          roles: ["customer"],
          permissions: ["read"],
          emailVerified: true,
          status: "ACTIVE",
        },
      },
    } as never);
    const { result } = renderHook(() => useResetPassword("token-123"), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ password: "NewPass123!", confirmPassword: "NewPass123!" });
    });
    expect(authApi.resetPassword).toHaveBeenCalled();
  });
});
