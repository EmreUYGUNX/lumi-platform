import { z } from "zod";

import { emailSchema } from "./common.js";

export const LoginRequestSchema = z.object({
  email: emailSchema,
  password: z
    .string({ required_error: "Password is required." })
    .min(1, "Password is required.")
    .max(256, "Password exceeds maximum length."),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;
