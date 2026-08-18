import "server-only";

import { OPERATOR } from "@/lib/legal";
import type { ContactInput } from "@/lib/validation/contact";
import { EMAIL_FROM, emailEnabled, resend } from "./client";

export async function sendContactEmail(
  input: Pick<ContactInput, "email" | "subject" | "message">,
  userId?: string,
) {
  if (!emailEnabled || !resend) {
    throw new Error("Contact email is not configured.");
  }

  const account = userId ? `Signed-in user: ${userId}\n` : "Visitor is not signed in.\n";
  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: OPERATOR.email,
    replyTo: input.email,
    subject: `[Docket contact] ${input.subject}`,
    text: [
      "A message was sent through the Docket contact form.",
      "",
      `From: ${input.email}`,
      account.trimEnd(),
      "",
      input.message,
    ].join("\n"),
  });

  if (error) throw new Error(error.message);
}
