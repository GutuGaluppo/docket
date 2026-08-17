import type { Metadata } from "next";

import { auth } from "@/auth";
import { DeleteAccountForm } from "@/components/settings/DeleteAccountForm";
import { getEntryCounts } from "@/server/db/queries/applications";
import { requireScope } from "@/server/auth/session";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const scope = await requireScope();
  const [session, counts] = await Promise.all([auth(), getEntryCounts(scope)]);

  return (
    <>
      <header className="border-b-2 border-ink pb-4">
        <p className="eyebrow mb-1.5 text-stamp">Account</p>
        <h1 className="text-[clamp(28px,5vw,42px)] leading-none font-bold tracking-[-0.02em]">
          Settings
        </h1>
      </header>

      <section className="mt-6 rounded-[3px] border border-rule bg-card p-6 shadow-paper">
        <p className="eyebrow mb-4 text-muted">Identity</p>
        <dl className="grid gap-3 font-mono text-[13px] sm:grid-cols-[140px_1fr]">
          <dt className="text-muted">Signed in as</dt>
          <dd>{session?.user?.email ?? "—"}</dd>
          <dt className="text-muted">Entries on file</dt>
          <dd>{String(counts.total).padStart(3, "0")}</dd>
        </dl>
      </section>

      <section className="mt-6 rounded-[3px] border border-rule bg-card p-6 shadow-paper">
        <p className="eyebrow mb-2 text-muted">Your data</p>
        <p className="max-w-[60ch] text-sm text-muted">
          The record is yours. Take it whenever you want, in either format, with no notice and no
          limit. We do not sell it and we never send it to recruiters.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a className="btn btn-quiet" href="/settings/export" download>
            Download JSON
          </a>
          <a className="btn btn-quiet" href="/docket/export" download>
            Download CSV
          </a>
        </div>
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
