import { z } from "zod";

export const twoFactorFormSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "6 haneli kod gerekli"),
  trustDevice: z.boolean(),
});

export type TwoFactorFormValues = z.input<typeof twoFactorFormSchema>;
