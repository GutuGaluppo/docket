import { z } from "zod";

export const contactSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  /**
   * The subject becomes an email header. Resend takes JSON rather than raw SMTP,
   * so a newline here is not the classic header-injection hole, but a value
   * bound for a header has no business carrying control characters either way —
   * stripped at the edge instead of trusted downstream.
   */
  subject: z
    .string()
    .trim()
    .min(3)
    .max(120)
    .transform((value) => value.replace(/[\u0000-\u001f\u007f]/g, " ").trim())
    .refine((value) => value.length >= 3, "Subject is too short."),
  message: z.string().trim().min(10).max(5_000),
  // Filled only by bots. Keeping it in the schema makes unknown form data inert.
  company: z.string().max(0).default(""),
});

export type ContactInput = z.infer<typeof contactSchema>;
