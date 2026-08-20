import type { Metadata } from "next";
import { Suspense } from "react";

import { DeleteAccountForm } from "@/components/settings/DeleteAccountForm";
import { FollowUpSettings } from "@/components/settings/FollowUpSettings";
import { ProNotice } from "@/components/billing/ProNotice";
import { Bar, Placeholder } from "@/components/Skeleton";
import { getEntryCounts } from "@/server/db/queries/applications";
import { canUseFollowUps, type LimitVerdict } from "@/server/billing/limits";
import { getFollowUpDays } from "@/server/db/queries/reminders";
import { getSession, requireScope } from "@/server/auth/session";

export const metadata: Metadata = { title: "Settings" };

/**
 * The terms are written once and used twice: by the real rows and by the
 * placeholder standing in for them. "Signed in as" is not waiting on anything,
 * so it is on screen from the first paint and only the value beside it is late.
 */
function IdentityRows({ email, entries }: { email: React.ReactNode; entries: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted">Signed in as</dt>
      <dd>{email}</dd>
      <dt className="text-muted">Entries on file</dt>
      <dd>{entries}</dd>
    </>
  );
}

async function Identity({ identity }: { identity: Promise<{ email: string; total: number }> }) {
  const { email, total } = await identity;
  return <IdentityRows email={email} entries={String(total).padStart(3, "0")} />;
}

async function FollowUps({
  followUps,
}: {
  followUps: Promise<{ current: number | null; verdict: LimitVerdict }>;
}) {
  const { current, verdict } = await followUps;

  if (verdict.allowed) return <FollowUpSettings current={current} />;

  return (
    <div className="mt-4">
      <ProNotice limit="follow-ups" title="Follow-up reminders are a Pro feature">
        <p>
          Everything the reminder would read is already in the register — what is behind Pro is the
          sending. Nothing scheduled is lost: an application that goes quiet stays visible in the
          first column of the board, which is where the reminder would have pointed anyway.
        </p>
      </ProNotice>
    </div>
  );
}

export default function SettingsPage() {
  const identity = requireScope().then(async (scope) => {
    const [session, counts] = await Promise.all([getSession(), getEntryCounts(scope)]);
    return { email: session?.user?.email ?? "—", total: counts.total };
  });

  const followUps = requireScope().then(async (scope) => {
    const [current, verdict] = await Promise.all([getFollowUpDays(scope), canUseFollowUps(scope)]);
    return { current, verdict };
  });

  return (
    <>
      <header className="border-b-2 border-ink pb-4">
        <p className="eyebrow mb-1.5 text-stamp">Account</p>
        <h1 className="text-[clamp(var(--text-2xl),5vw,var(--text-5xl))] leading-none font-bold tracking-[-0.025em]">
          Settings
        </h1>
      </header>

      <section className="mt-6 rounded-[3px] border border-rule bg-card p-6 shadow-paper">
        <p className="eyebrow mb-4 text-muted">Identity</p>
        <dl className="grid gap-3 font-mono text-[13px] sm:grid-cols-[140px_1fr]">
          <Suspense
            fallback={
              <IdentityRows
                email={<Bar className="h-3 w-52" />}
                entries={<Bar className="h-3 w-9" />}
              />
            }
          >
            <Identity identity={identity} />
          </Suspense>
        </dl>
      </section>

      <section className="mt-6 rounded-[3px] border border-rule bg-card p-6 shadow-paper">
        <p className="eyebrow mb-2 text-muted">Follow-ups</p>
        <p className="max-w-[60ch] text-sm text-muted">
          One email when an application has sat in the first column without an answer for longer
          than you chose. One reminder per application, never a second — this is a list, not a
          campaign.
        </p>
        <Suspense
          fallback={
            <Placeholder label="the follow-up setting" className="mt-4">
              <Bar className="h-9 w-64" />
            </Placeholder>
          }
        >
          <FollowUps followUps={followUps} />
        </Suspense>
      </section>

      {/* Everything below is prose and links. It has never needed a query, and
          nothing here waits for one. */}
      <section className="mt-6 rounded-[3px] border border-rule bg-card p-6 shadow-paper">
        <p className="eyebrow mb-2 text-muted">Your data</p>
        <p className="max-w-[60ch] text-sm text-muted">
          The record is yours. Take it whenever you want, in any format here, with no notice and no
          limit. We do not sell it and we never send it to recruiters.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a className="btn btn-quiet" href="/docket/export?format=pdf" download>
            Download PDF
          </a>
          <a className="btn btn-quiet" href="/docket/export?format=xlsx" download>
            Download Excel
          </a>
          <a className="btn btn-quiet" href="/docket/export?format=csv" download>
            Download CSV
          </a>
          <a className="btn btn-quiet" href="/settings/export" download>
            Download JSON
          </a>
        </div>
        <p className="mt-3 max-w-[60ch] text-xs text-muted">
          The first three are the table: printable, as a workbook, and as plain text. The JSON is
          everything the account holds, including the parts no table shows.
        </p>
      </section>

      <section className="mt-6 rounded-[3px] border border-flag/40 bg-card p-6">
        <p className="eyebrow mb-2 text-flag">Close the file</p>
        <p className="max-w-[60ch] text-sm text-muted">
          Deleting the account removes every entry, tag and status event immediately and for good.
          There is no recovery window. Export first if you want to keep the record.
        </p>
        <DeleteAccountForm />
      </section>
    </>
  );
}
