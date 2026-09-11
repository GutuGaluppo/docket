import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EditEntryForm } from "@/components/docket/EditEntryForm";
import { CompanyLogo } from "@/components/docket/CompanyLogo";
import { PageTitleBeacon } from "@/components/shell/PageTitle";
import { Stamp } from "@/components/docket/Stamp";
import { EntrySheetSkeleton } from "@/components/Skeleton";
import { protocolNumber } from "@/lib/format";
import { requireScope } from "@/server/auth/session";
import { getEntry } from "@/server/db/queries/applications";

export const metadata: Metadata = { title: "Correct entry" };

/**
 * Nothing on this screen is knowable without the row: the number, the company,
 * the stamp and every field of the form are the entry. So the whole sheet is
 * one boundary — the only thing that can be printed before the query answers is
 * the way back, which is exactly what someone who opened the wrong row wants.
 */
async function Sheet({ id }: { id: string }) {
  const scope = await requireScope();

  // getEntry is scoped, so another account's id and a deleted one both arrive
  // here as null — and both leave as the same 404.
  const entry = await getEntry(scope, id);
  if (!entry) notFound();

  return (
    <>
      <PageTitleBeacon title={`Correcting ${entry.company}`} />

      <header className="sheet-head mt-5">
        <div className="sheet-identity">
          <CompanyLogo company={entry.company} website={entry.website} />
          <div className="min-w-0">
            <p className="eyebrow text-stamp">Nº {protocolNumber(entry.protocolNumber)}</p>
            <h1 className="sheet-company">{entry.company}</h1>
            <p className="sheet-position">{entry.position}</p>
          </div>
        </div>
        <Stamp
          at={entry.createdAt}
          timezone={entry.timezone}
          status={entry.stage}
          rejected={entry.rejectedAt != null}
          size={172}
        />
      </header>

      <EditEntryForm entry={entry} />
    </>
  );
}

export default async function EditEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <>
      <Link href={`/applications/${id}`} className="eyebrow text-muted hover:text-stamp">
        ← Back to the entry
      </Link>

      <Suspense fallback={<EntrySheetSkeleton />}>
        <Sheet id={id} />
      </Suspense>
    </>
  );
}
