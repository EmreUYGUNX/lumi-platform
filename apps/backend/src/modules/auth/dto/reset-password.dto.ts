import { z } from "zod";

import { passwordSchema } from "./common.js";

const tokenSchema = z
  .string({ required_error: "Token is required." })
  .trim()
  .min(10, "Token format is invalid.");

export const ResetPasswordRequestSchema = z.object({
  token: tokenSchema,
  password: passwordSchema,
});

export type ResetPasswordRequest = z.infer<typeof ResetPasswordRequestSchema>;
