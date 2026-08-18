import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EditEntryForm } from "@/components/docket/EditEntryForm";
import { Stamp } from "@/components/docket/Stamp";
import { requireScope } from "@/server/auth/session";
import { getEntry } from "@/server/db/queries/applications";

export const metadata: Metadata = { title: "Correct entry" };

export default async function EditEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const scope = await requireScope();
  const { id } = await params;

  // getEntry is scoped, so another account's id and a deleted one both arrive
  // here as null — and both leave as the same 404.
  const entry = await getEntry(scope, id);
  if (!entry) notFound();

  return (
    <main className="mx-auto max-w-[900px] px-5 py-10">
      <Link href="/docket" className="eyebrow text-muted hover:text-stamp">
        ← Back to the docket
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="eyebrow mb-2 text-stamp">
            Nº {String(entry.protocolNumber).padStart(3, "0")}
          </p>
          <h1 className="text-3xl font-bold tracking-[-0.02em]">{entry.company}</h1>
          <p className="mt-1 text-muted">{entry.position}</p>
        </div>
        <Stamp at={entry.createdAt} timezone={entry.timezone} />
      </div>

      <EditEntryForm entry={entry} />
    </main>
  );
}
