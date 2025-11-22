import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { authApi } from "../api";
import {
  authMetaSchema,
  isLoginResponse,
  isRegisterResponse,
  loginRequestSchema,
  loginResponseSchema,
  logoutAllResponseSchema,
  logoutResponseSchema,
  messageResponseSchema,
  registerRequestSchema,
  registerResponseSchema,
  resendVerificationRequestSchema,
  sessionDataSchema,
  userProfileSchema,
} from "../contracts";
import { transformSessionData } from "../transformers";

const API_BASE_URL = "http://localhost:4000/api/v1";

const meta = {
  timestamp: new Date().toISOString(),
  requestId: "req-12345678",
};

const baseUser = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "customer@lumi.com",
  firstName: "Customer",
  lastName: "Demo",
  phone: "+905551112233",
  emailVerified: true,
  status: "ACTIVE" as const,
  roles: ["customer"],
  permissions: ["read:profile", "update:profile"],
};

const buildUser = (overrides: Partial<typeof baseUser> = {}) => ({
  ...baseUser,
  ...overrides,
});

const buildSessionEnvelope = () => ({
  success: true as const,
  data: {
    sessionId: "00000000-0000-0000-0000-000000000001",
    accessToken: "access-token-value",
    refreshToken: "refresh-token-value",
    accessTokenExpiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    refreshTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    user: buildUser(),
    emailVerified: true,
  },
  meta,
});

const buildRegisterEnvelope = () => ({
  success: true as const,
  data: {
    user: buildUser(),
    emailVerification: {
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    },
  },
  meta,
});

const buildUserEnvelope = (overrides: Partial<typeof baseUser> = {}) => ({
  success: true as const,
  data: {
    user: buildUser(overrides),
  },
  meta,
});

const buildMessageEnvelope = (message: string) => ({
  success: true as const,
  data: { message },
  meta,
});

const buildLogoutEnvelope = () => ({
  success: true as const,
  data: { sessionId: "00000000-0000-0000-0000-000000000001" },
  meta,
});

const buildLogoutAllEnvelope = () => ({
  success: true as const,
  data: { revokedSessions: 3 },
  meta,
});

const server = setupServer(
  http.post(`${API_BASE_URL}/auth/login`, async ({ request }) => {
    const body = await request.json();
    expect(loginRequestSchema.safeParse(body).success).toBe(true);
    return HttpResponse.json(buildSessionEnvelope());
  }),
  http.post(`${API_BASE_URL}/auth/register`, async ({ request }) => {
    const body = await request.json();
    expect(registerRequestSchema.safeParse(body).success).toBe(true);
    return HttpResponse.json(buildRegisterEnvelope(), { status: 201 });
  }),
  http.post(`${API_BASE_URL}/auth/refresh`, () => HttpResponse.json(buildSessionEnvelope())),
  http.post(`${API_BASE_URL}/auth/logout`, () => HttpResponse.json(buildLogoutEnvelope())),
  http.post(`${API_BASE_URL}/auth/logout-all`, () => HttpResponse.json(buildLogoutAllEnvelope())),
  http.post(`${API_BASE_URL}/auth/forgot-password`, () =>
    HttpResponse.json(buildMessageEnvelope("If the account exists, a reset email was sent.")),
  ),
  http.post(`${API_BASE_URL}/auth/reset-password`, () => HttpResponse.json(buildUserEnvelope())),
  http.post(`${API_BASE_URL}/auth/verify-email`, () => HttpResponse.json(buildUserEnvelope())),
  http.post(`${API_BASE_URL}/auth/resend-verification`, async ({ request }) => {
    const body = await request.json();
    expect(resendVerificationRequestSchema.safeParse(body).success).toBe(true);
    return HttpResponse.json(buildUserEnvelope());
  }),
  http.post(`${API_BASE_URL}/auth/magic-link`, () =>
    HttpResponse.json(buildMessageEnvelope("Magic link sent")),
  ),
  http.get(`${API_BASE_URL}/auth/me`, () => HttpResponse.json(buildUserEnvelope())),
  http.put(`${API_BASE_URL}/auth/me`, async ({ request }) => {
    const body = (await request.json()) as { firstName?: string; lastName?: string };
    return HttpResponse.json(buildUserEnvelope(body));
  }),
  http.put(`${API_BASE_URL}/auth/password`, () =>
    HttpResponse.json(buildUserEnvelope({ emailVerified: true })),
  ),
  http.put(`${API_BASE_URL}/auth/change-password`, () =>
    HttpResponse.json(buildUserEnvelope({ emailVerified: true })),
  ),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("auth contracts", () => {
  it("validates login request and Q2 response envelopes", () => {
    const parsed = loginRequestSchema.safeParse({
      email: "TestUser@Example.com ",
      password: "Sup3rSecur3!",
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.email).toBe("testuser@example.com");

    const sessionEnvelope = buildSessionEnvelope();
    expect(isLoginResponse(sessionEnvelope)).toBe(true);
    expect(loginResponseSchema.safeParse(sessionEnvelope).success).toBe(true);
    expect(isLoginResponse({ success: true, data: {} })).toBe(false);
  });

  it("validates register request and response envelopes", () => {
    const parsed = registerRequestSchema.safeParse({
      email: "NEW@EXAMPLE.COM ",
      password: "StrongPass123!",
      firstName: "New",
      lastName: "User",
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.email).toBe("new@example.com");

    expect(isRegisterResponse(buildRegisterEnvelope())).toBe(true);
    expect(registerResponseSchema.safeParse(buildRegisterEnvelope()).success).toBe(true);
    expect(
      isRegisterResponse({ success: false, error: { code: "INVALID", message: "nope" } }),
    ).toBe(false);
  });
});

describe("auth API client with MSW", () => {
  it("covers the auth surface area with Q2 compliance", async () => {
    const loginResult = await authApi.login({
      email: "customer@lumi.com",
      password: "Sup3rSecur3!",
    });
    expect(sessionDataSchema.safeParse(loginResult.data).success).toBe(true);
    expect(loginResult.meta?.requestId).toBe(meta.requestId);
    const transformed = transformSessionData(loginResult.data);
    expect(transformed.accessTokenExpiresAt).toBeInstanceOf(Date);

    const registerResult = await authApi.register({
      email: "newuser@lumi.com",
      password: "Sup3rSecur3!",
      firstName: "New",
      lastName: "User",
    });
    expect(registerResponseSchema.safeParse({ ...registerResult, success: true }).success).toBe(
      true,
    );

    const profile = await authApi.getProfile();
    expect(userProfileSchema.safeParse(profile.data.user).success).toBe(true);

    const refreshed = await authApi.refreshToken();
    expect(refreshed.data.sessionId).toBeDefined();

    const updateProfile = await authApi.updateProfile({ firstName: "Updated" });
    expect(updateProfile.data.user.firstName).toBe("Updated");

    server.use(
      http.put(`${API_BASE_URL}/auth/password`, () =>
        HttpResponse.json(
          {
            success: false,
            error: { code: "NOT_FOUND", message: "fallback" },
          },
          { status: 404 },
        ),
      ),
    );

    const passwordChange = await authApi.updatePassword({
      currentPassword: "Sup3rSecur3!",
      newPassword: "Sup3rSecur3!Updated",
    });
    expect(passwordChange.data.user.emailVerified).toBe(true);

    const verifyEmail = await authApi.verifyEmail({ token: "token-1234567890" });
    expect(verifyEmail.data.user.emailVerified).toBe(true);

    const resend = await authApi.resendVerification({});
    expect(resend.data.user.emailVerified).toBe(true);

    const reset = await authApi.resetPassword({
      token: "token-1234567890",
      password: "Sup3rSecur3!Updated",
    });
    expect(reset.data.user.email).toBe(baseUser.email);

    const forgot = await authApi.forgotPassword({ email: "customer@lumi.com" });
    expect(messageResponseSchema.safeParse({ ...forgot, success: true }).success).toBe(true);

    const magic = await authApi.magicLink({ email: "customer@lumi.com" });
    expect(magic.data.message).toMatch(/magic link/i);

    const logoutResult = await authApi.logout();
    expect(logoutResponseSchema.safeParse({ ...logoutResult, success: true }).success).toBe(true);

    const logoutAll = await authApi.logoutAll();
    expect(logoutAllResponseSchema.safeParse({ ...logoutAll, success: true }).success).toBe(true);

    expect(authMetaSchema.safeParse(loginResult.meta ?? {}).success).toBe(true);
  });
});
