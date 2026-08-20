import type { Metadata } from "next";
import { Fragment, Suspense } from "react";
import Link from "next/link";

import { EntriesTable } from "@/components/docket/EntriesTable";
import { StampForm } from "@/components/docket/StampForm";
import { Bar, FiguresSkeleton, Placeholder, TableSkeleton } from "@/components/Skeleton";
import type { ExportFormat } from "@/lib/export/entries";
import { listQuerySchema, type ListQuery } from "@/lib/validation/entry";
import {
  getEntryCounts,
  listEntries,
  type Entry,
  type EntryCounts,
} from "@/server/db/queries/applications";
import { requireScope } from "@/server/auth/session";

export const metadata: Metadata = { title: "Your docket" };

/**
 * Three files, one register. The order is the order of intent: a PDF is read,
 * a workbook is worked in, and CSV is what you hand to software that has to
 * accept anything.
 */
const EXPORT_LINKS: ReadonlyArray<{ format: ExportFormat; label: string; hint: string }> = [
  { format: "pdf", label: "PDF", hint: "The table as a printable page" },
  { format: "xlsx", label: "Excel", hint: "A workbook with typed columns, ready to open" },
  { format: "csv", label: "CSV", hint: "Plain text, for anything else" },
];

/**
 * The counters are the only part of the heading that waits. The title and the
 * line under it read the same whether or not the register has arrived, so they
 * are printed immediately and these three numbers stream in beside them.
 */
async function Figures({ counts }: { counts: Promise<EntryCounts> }) {
  const totals = await counts;

  return (
    <>
      <div>
        <b className="block text-2xl leading-none font-bold">
          {String(totals.total).padStart(2, "0")}
        </b>
        <span className="text-[10px] tracking-[0.14em] text-muted uppercase">In total</span>
      </div>
      <div>
        <b className="block text-2xl leading-none font-bold">
          {String(totals.thisMonth).padStart(2, "0")}
        </b>
        <span className="text-[10px] tracking-[0.14em] text-muted uppercase">This month</span>
      </div>
      {/* The total counts everything ever stamped, so the gap between it and
          the rows below has to be accounted for somewhere visible. */}
      {totals.rejected > 0 && (
        <Link href="/archive" className="no-underline">
          <b className="block text-2xl leading-none font-bold">
            {String(totals.rejected).padStart(2, "0")}
          </b>
          <span className="text-[10px] tracking-[0.14em] text-muted uppercase underline decoration-dotted underline-offset-4">
            Filed
          </span>
        </Link>
      )}
    </>
  );
}

/**
 * Hidden on an empty register, which is a fact only the count knows — so the
 * links wait for it. They sit at the end of a row that is already on screen,
 * and appearing there moves nothing, which is why this fallback is empty
 * rather than a shape.
 */
async function ExportLinks({ counts, search }: { counts: Promise<EntryCounts>; search: string }) {
  const { total } = await counts;
  if (total === 0) return null;

  /**
   * The search that is on screen is the search the file is taken through, so a
   * filtered docket exports the rows the person is actually looking at.
   */
  const exportHref = (format: ExportFormat) => {
    const params = new URLSearchParams({ format });
    if (search) params.set("q", search);
    return `/docket/export?${params.toString()}`;
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="eyebrow text-muted">{search ? "Export these results" : "Export"}</span>
      {EXPORT_LINKS.map(({ format, label, hint }, index) => (
        <Fragment key={format}>
          {index > 0 && (
            <span aria-hidden="true" className="text-faint">
              ·
            </span>
          )}
          <a className="link-quiet" href={exportHref(format)} title={hint} download>
            {label}
          </a>
        </Fragment>
      ))}
    </div>
  );
}

/** The rows themselves, and the three things it can mean to have none. */
async function Register({
  entries,
  counts,
  query,
}: {
  entries: Promise<Entry[]>;
  counts: Promise<EntryCounts>;
  query: ListQuery;
}) {
  const [rows, totals] = await Promise.all([entries, counts]);

  if (rows.length > 0) {
    return (
      <EntriesTable
        entries={rows}
        search={query.q}
        sort={{ field: query.sort, direction: query.dir }}
      />
    );
  }

  return (
    <div className="rounded-[3px] border border-dashed border-rule bg-card px-6 py-12 text-center">
      <p className="eyebrow mb-2.5 text-stamp">Blank register</p>
      <p className="text-base text-muted">
        {totals.total === 0 ? (
          <>
            Your docket is empty. Stamp your first application above, or{" "}
            <Link href="/docket/import" className="border-b border-stamp text-ink">
              import what you already have
            </Link>
            .
          </>
        ) : query.q ? (
          "No open entry matches that search."
        ) : (
          <>
            Nothing is waiting on an answer. Every entry is{" "}
            <Link href="/archive" className="border-b border-stamp text-ink">
              in the archive
            </Link>
            .
          </>
        )}
      </p>
    </div>
  );
}

export default async function DocketPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const query = listQuerySchema.parse({
    q: typeof raw.q === "string" ? raw.q : undefined,
    sort: typeof raw.sort === "string" ? raw.sort : undefined,
    dir: typeof raw.dir === "string" ? raw.dir : undefined,
  });

  /**
   * Started here, awaited inside the boundaries below.
   *
   * Nothing on this page's own path touches the database, so the heading and —
   * more to the point — the stamp form are on screen and usable while these are
   * still in flight. Both start from the same session read, which is memoised
   * per request, so two promises are still one round trip for the session and
   * one query each.
   */
  const counts = requireScope().then(getEntryCounts);
  const entries = requireScope().then((scope) =>
    listEntries(scope, { search: query.q, sort: query.sort, direction: query.dir }),
  );

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink pb-4">
        <div>
          <p className="eyebrow mb-1.5 text-stamp">Personal register · kept by you</p>
          <h1 className="text-[clamp(var(--text-2xl),5vw,var(--text-5xl))] leading-none font-bold tracking-[-0.025em]">
            Your docket
          </h1>
          <p className="mt-2 max-w-[46ch] text-sm text-muted">
            Every application gets a number and a stamp with the local date and time it was sent.
            The ones that ended in a refusal are kept in the archive.
          </p>
        </div>
        <div className="flex gap-6 font-mono">
          <Suspense fallback={<FiguresSkeleton label="the counters" />}>
            <Figures counts={counts} />
          </Suspense>
        </div>
      </header>

      <StampForm />

      <div className="my-8 mb-2.5 flex flex-wrap items-center justify-between gap-3">
        <form
          method="get"
          action="/docket"
          className="flex items-center gap-2"
          suppressHydrationWarning
        >
          <input
            type="search"
            name="q"
            defaultValue={query.q}
            className="min-w-[240px] rounded-[2px] border border-rule bg-sheet px-3 py-2 font-mono text-[13px] focus:border-stamp focus:outline-none"
            placeholder="Search company, position, stack or city"
            aria-label="Search your docket"
            suppressHydrationWarning
          />
          <input type="hidden" name="sort" value={query.sort} />
          <input type="hidden" name="dir" value={query.dir} />
          <button type="submit" className="link-quiet" suppressHydrationWarning>
            Search
          </button>
        </form>
        <Suspense
          fallback={
            <Placeholder label="the export links">
              <Bar className="h-4 w-40" />
            </Placeholder>
          }
        >
          <ExportLinks counts={counts} search={query.q} />
        </Suspense>
      </div>

      <Suspense fallback={<TableSkeleton label="the register" />}>
        <Register entries={entries} counts={counts} query={query} />
      </Suspense>
    </>
  );
}
