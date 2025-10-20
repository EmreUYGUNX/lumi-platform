import { z } from "zod";

import { emailSchema, nameSchema, passwordSchema, phoneSchema } from "./common.js";

export const RegisterRequestSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: nameSchema,
  lastName: nameSchema,
  phone: phoneSchema,
});

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
