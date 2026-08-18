import "server-only";

import { ContactEmail } from "@/emails/ContactEmail";
import { OPERATOR } from "@/lib/legal";
import type { ContactInput } from "@/lib/validation/contact";
import { EMAIL_FROM, emailEnabled, resend } from "./client";

export async function sendContactEmail(
  input: Pick<ContactInput, "name" | "email" | "subject" | "message">,
  userId?: string,
) {
  if (!emailEnabled || !resend) {
    throw new Error("Contact email is not configured.");
  }

  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: OPERATOR.email,
    replyTo: input.email,
    subject: `[Docket contact] ${input.subject}`,
    react: ContactEmail({ ...input, userId }),
  });

  if (error) throw new Error(error.message);
}
