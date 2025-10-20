import { z } from "zod";

import {
  DEFAULT_PASSWORD_POLICY,
  type PasswordValidationIssue,
  validatePasswordStrength,
} from "@/lib/crypto/password.js";

const buildPasswordIssues = (password: string): PasswordValidationIssue[] =>
  validatePasswordStrength(password, DEFAULT_PASSWORD_POLICY).issues.filter(
    (issue) => issue.code !== "min_length",
  );

const trimString = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => (typeof value === "string" ? value.trim() : value), schema);

export const emailSchema = trimString(
  z
    .string({ required_error: "Email is required." })
    .min(1, "Email is required.")
    .email("Email address is invalid.")
    .transform((value) => value.toLowerCase()),
);

export const passwordSchema = trimString(
  z
    .string({ required_error: "Password is required." })
    .min(
      DEFAULT_PASSWORD_POLICY.minLength,
      `Password must be at least ${DEFAULT_PASSWORD_POLICY.minLength} characters long.`,
    )
    .superRefine((value, ctx) => {
      buildPasswordIssues(value).forEach((issue) => {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: issue.message,
          path: ctx.path,
        });
      });
    }),
);

const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 100;

export const nameSchema = trimString(
  z
    .string({ required_error: "Name is required." })
    .min(NAME_MIN_LENGTH, `Name must be at least ${NAME_MIN_LENGTH} characters.`)
    .max(NAME_MAX_LENGTH, `Name must be at most ${NAME_MAX_LENGTH} characters.`),
);

const PHONE_PATTERN = /^\+?[\d\s().-]{7,20}$/;

export const phoneSchema = z
  .union([
    z.undefined(),
    trimString(
      z
        .string()
        .nonempty("Phone number cannot be empty.")
        .regex(PHONE_PATTERN, "Phone number format is invalid."),
    ),
  ])
  .transform((value) => (typeof value === "string" ? value : undefined));
