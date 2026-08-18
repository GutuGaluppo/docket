"use server";

import { auth } from "@/auth";
import { contactSchema } from "@/lib/validation/contact";
import { sendContactEmail } from "@/server/email/contact";
import { createLimiter } from "@/server/rate-limit";

export type ContactResult = { ok: true; message: string } | { ok: false; error: string };

/**
 * The form is reachable from the public footer, so this action sends email on
 * behalf of anyone who can craft a POST. The honeypot stops a crawler filling
 * every field it finds; it does nothing against a loop aimed at this endpoint,
 * and every accepted call spends the operator's sending reputation.
 *
 * Keyed by account where there is one, and by the address given otherwise —
 * with an instance-wide cap behind it, because an anonymous caller chooses that
 * address freely. See rate-limit.ts for what a per-instance counter promises
 * and what it does not.
 */
const limiter = createLimiter({
  minGapMs: 20_000,
  windowMs: 60 * 60_000,
  perKey: 5,
  perInstance: 60,
});

export async function submitContact(input: unknown): Promise<ContactResult> {
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Check your email, subject, and message." };
  }

  const session = await auth();

  const key = session?.user?.id ?? parsed.data.email.toLowerCase();
  if (limiter.exceeded(key)) {
    return {
      ok: false,
      error: "That is a lot of messages at once. Try again in a few minutes.",
    };
  }

  try {
    await sendContactEmail(parsed.data, session?.user?.id);
    return { ok: true, message: "Message sent. We'll reply by email." };
  } catch {
    return {
      ok: false,
      error: "The message could not be sent right now. Please try again later.",
    };
  }
}
