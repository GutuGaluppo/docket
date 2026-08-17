import "server-only";

import { FollowUpEmail } from "@/emails/FollowUpEmail";
import { EMAIL_FROM, emailEnabled, resend } from "./client";
import {
  claimReminders,
  findDueReminders,
  releaseReminders,
} from "@/server/db/queries/reminders";

export type RunReport = {
  usersDue: number;
  applicationsDue: number;
  sent: number;
  failed: number;
  skippedNoCredentials: boolean;
};

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * One email per person, listing everything that has gone quiet — not one email
 * per application. Someone with twenty stale applications should get a list,
 * not twenty notifications; that difference is the whole reason this feature
 * can be trusted with an inbox.
 */
export async function runFollowUps(): Promise<RunReport> {
  const batches = await findDueReminders();
  const applicationsDue = batches.reduce((sum, b) => sum + b.applications.length, 0);

  const report: RunReport = {
    usersDue: batches.length,
    applicationsDue,
    sent: 0,
    failed: 0,
    skippedNoCredentials: !emailEnabled,
  };

  // Without credentials the job still reports what it found, so the schedule can
  // be verified before any address is ever contacted.
  if (!emailEnabled || !resend) return report;

  const base = appUrl();

  for (const batch of batches) {
    const ids = batch.applications.map((a) => a.id);
    // Claim first: a duplicate nudge costs more trust than a missed one.
    const claimed = await claimReminders(ids);
    if (claimed.length === 0) continue;

    const items = batch.applications.filter((a) => claimed.includes(a.id));

    try {
      const { error } = await resend.emails.send({
        from: EMAIL_FROM,
        to: batch.email,
        subject:
          items.length === 1
            ? `No answer from ${items[0]?.company} after ${batch.followUpDays} days`
            : `${items.length} applications with no answer after ${batch.followUpDays} days`,
        react: FollowUpEmail({
          items,
          days: batch.followUpDays,
          settingsUrl: `${base}/settings`,
          docketUrl: `${base}/docket`,
        }),
      });

      if (error) throw new Error(error.message);
      report.sent += 1;
    } catch {
      // Hand the work back so the next run retries it.
      await releaseReminders(claimed);
      report.failed += 1;
    }
  }

  return report;
}
