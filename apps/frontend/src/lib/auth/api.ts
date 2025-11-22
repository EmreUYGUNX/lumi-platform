import { type z } from "zod";

import { ApiClientError, apiClient, type ApiRequestResult } from "@/lib/api-client";

import {
  authMetaSchema,
  logoutAllResponseSchema,
  logoutResponseSchema,
  magicLinkRequestSchema,
  messageResponseSchema,
  forgotPasswordRequestSchema,
  loginRequestSchema,
  registerResponseSchema,
  resendVerificationRequestSchema,
  registerRequestSchema,
  resetPasswordRequestSchema,
  sessionDataSchema,
  updatePasswordRequestSchema,
  updateProfileRequestSchema,
  verifyEmailRequestSchema,
  userResponseSchema,
  type ForgotPasswordRequest,
  type LoginRequest,
  type MagicLinkRequest,
  type RegisterRequest,
  type ResetPasswordRequest,
  type ResendVerificationRequest,
  type UpdatePasswordRequest,
  type UpdateProfileRequest,
  type VerifyEmailRequest,
} from "./contracts";

type AuthResult<TSchema extends z.ZodTypeAny> = Promise<
  ApiRequestResult<TSchema, typeof authMetaSchema>
>;

const AUTH_BASE_PATH = "/auth";

const endpoints = {
  login: `${AUTH_BASE_PATH}/login`,
  register: `${AUTH_BASE_PATH}/register`,
  logout: `${AUTH_BASE_PATH}/logout`,
  logoutAll: `${AUTH_BASE_PATH}/logout-all`,
  refresh: `${AUTH_BASE_PATH}/refresh`,
  forgotPassword: `${AUTH_BASE_PATH}/forgot-password`,
  resetPassword: `${AUTH_BASE_PATH}/reset-password`,
  verifyEmail: `${AUTH_BASE_PATH}/verify-email`,
  resendVerification: `${AUTH_BASE_PATH}/resend-verification`,
  magicLink: `${AUTH_BASE_PATH}/magic-link`,
  profile: `${AUTH_BASE_PATH}/me`,
  updateProfile: `${AUTH_BASE_PATH}/me`,
  updatePasswordPrimary: `${AUTH_BASE_PATH}/password`,
  updatePasswordFallback: `${AUTH_BASE_PATH}/change-password`,
} as const;

const registerDataSchema = registerResponseSchema.shape.data;
const userDataSchema = userResponseSchema.shape.data;
const messageDataSchema = messageResponseSchema.shape.data;
const logoutDataSchema = logoutResponseSchema.shape.data;
const logoutAllDataSchema = logoutAllResponseSchema.shape.data;

export const login = (
  credentials: LoginRequest,
  signal?: AbortSignal,
): AuthResult<typeof sessionDataSchema> =>
  apiClient.post(endpoints.login, {
    body: loginRequestSchema.parse(credentials),
    dataSchema: sessionDataSchema,
    metaSchema: authMetaSchema,
    signal,
  });

export const register = (
  payload: RegisterRequest,
  signal?: AbortSignal,
): AuthResult<typeof registerDataSchema> =>
  apiClient.post(endpoints.register, {
    body: registerRequestSchema.parse(payload),
    dataSchema: registerDataSchema,
    metaSchema: authMetaSchema,
    signal,
  });

export const logout = (signal?: AbortSignal): AuthResult<typeof logoutDataSchema> =>
  apiClient.post(endpoints.logout, {
    dataSchema: logoutDataSchema,
    metaSchema: authMetaSchema,
    signal,
  });

export const logoutAll = (signal?: AbortSignal): AuthResult<typeof logoutAllDataSchema> =>
  apiClient.post(endpoints.logoutAll, {
    dataSchema: logoutAllDataSchema,
    metaSchema: authMetaSchema,
    signal,
  });

export const refreshToken = (signal?: AbortSignal): AuthResult<typeof sessionDataSchema> =>
  apiClient.post(endpoints.refresh, {
    dataSchema: sessionDataSchema,
    metaSchema: authMetaSchema,
    signal,
    credentials: "include",
  });

export const forgotPassword = (
  payload: ForgotPasswordRequest,
  signal?: AbortSignal,
): AuthResult<typeof messageDataSchema> =>
  apiClient.post(endpoints.forgotPassword, {
    body: forgotPasswordRequestSchema.parse(payload),
    dataSchema: messageDataSchema,
    metaSchema: authMetaSchema,
    signal,
  });

export const resetPassword = (
  payload: ResetPasswordRequest,
  signal?: AbortSignal,
): AuthResult<typeof userDataSchema> =>
  apiClient.post(endpoints.resetPassword, {
    body: resetPasswordRequestSchema.parse(payload),
    dataSchema: userDataSchema,
    metaSchema: authMetaSchema,
    signal,
  });

export const verifyEmail = (
  payload: VerifyEmailRequest,
  signal?: AbortSignal,
): AuthResult<typeof userDataSchema> =>
  apiClient.post(endpoints.verifyEmail, {
    body: verifyEmailRequestSchema.parse(payload),
    dataSchema: userDataSchema,
    metaSchema: authMetaSchema,
    signal,
  });

export const resendVerification = (
  payload?: ResendVerificationRequest,
  signal?: AbortSignal,
): AuthResult<typeof userDataSchema> =>
  apiClient.post(endpoints.resendVerification, {
    body: resendVerificationRequestSchema.parse(payload ?? {}),
    dataSchema: userDataSchema,
    metaSchema: authMetaSchema,
    signal,
  });

export const magicLink = (
  payload: MagicLinkRequest,
  signal?: AbortSignal,
): AuthResult<typeof messageDataSchema> =>
  apiClient.post(endpoints.magicLink, {
    body: magicLinkRequestSchema.parse(payload),
    dataSchema: messageDataSchema,
    metaSchema: authMetaSchema,
    signal,
  });

export const getProfile = (signal?: AbortSignal): AuthResult<typeof userDataSchema> =>
  apiClient.get(endpoints.profile, {
    dataSchema: userDataSchema,
    metaSchema: authMetaSchema,
    signal,
  });

export const updateProfile = (
  payload: UpdateProfileRequest,
  signal?: AbortSignal,
): AuthResult<typeof userDataSchema> =>
  apiClient.put(endpoints.updateProfile, {
    body: updateProfileRequestSchema.parse(payload),
    dataSchema: userDataSchema,
    metaSchema: authMetaSchema,
    signal,
  });

const updatePasswordWithFallback = async (
  payload: UpdatePasswordRequest,
  signal?: AbortSignal,
): AuthResult<typeof userDataSchema> => {
  try {
    return await apiClient.put(endpoints.updatePasswordPrimary, {
      body: updatePasswordRequestSchema.parse(payload),
      dataSchema: userDataSchema,
      metaSchema: authMetaSchema,
      signal,
    });
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) {
      return apiClient.put(endpoints.updatePasswordFallback, {
        body: updatePasswordRequestSchema.parse(payload),
        dataSchema: userDataSchema,
        metaSchema: authMetaSchema,
        signal,
      });
    }
    throw error;
  }
};

export const updatePassword = (
  payload: UpdatePasswordRequest,
  signal?: AbortSignal,
): AuthResult<typeof userDataSchema> => updatePasswordWithFallback(payload, signal);

export const authApi = {
  login,
  register,
  logout,
  logoutAll,
  refreshToken,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
  magicLink,
  getProfile,
  updateProfile,
  updatePassword,
};
