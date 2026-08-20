import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EditEntryForm } from "@/components/docket/EditEntryForm";
import { Stamp } from "@/components/docket/Stamp";
import { Bar, Placeholder } from "@/components/Skeleton";
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
    </>
  );
}

export default async function EditEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <main className="mx-auto max-w-[900px] px-5 py-10">
      <Link href="/docket" className="eyebrow text-muted hover:text-stamp">
        ← Back to the docket
      </Link>

      <Suspense
        fallback={
          <Placeholder label="the entry" className="mt-4 flex flex-col gap-5">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div className="flex flex-col gap-2">
                <Bar className="h-2.5 w-16" />
                <Bar className="h-8 w-56" />
                <Bar className="h-3 w-40" />
              </div>
              <Bar className="h-12 w-28" />
            </div>
            <Bar className="h-64 w-full" />
          </Placeholder>
        }
      >
        <Sheet id={id} />
      </Suspense>
    </main>
  );
}
