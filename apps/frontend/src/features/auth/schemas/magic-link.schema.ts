import { z } from "zod";

export const magicLinkFormSchema = z.object({
  email: z.string().trim().toLowerCase().email("Geçerli bir e-posta girin"),
});

export type MagicLinkFormValues = z.infer<typeof magicLinkFormSchema>;
