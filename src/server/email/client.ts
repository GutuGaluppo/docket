import "server-only";

import { Resend } from "resend";

/**
 * Inert without credentials, like Sentry: a checkout with no Resend key never
 * tries to send, and the cron reports what it would have done instead of
 * failing. `EMAIL_FROM` must be an address on a domain verified in Resend —
 * Resend rejects anything else, so both are required together.
 */
const apiKey = process.env.RESEND_API_KEY;

export const EMAIL_FROM = process.env.EMAIL_FROM ?? "";
export const emailEnabled = Boolean(apiKey && EMAIL_FROM);

export const resend = apiKey ? new Resend(apiKey) : null;
