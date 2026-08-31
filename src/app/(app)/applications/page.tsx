import type { Metadata } from "next";
import { Fragment, Suspense } from "react";
import Link from "next/link";

import { SectionHeader } from "@/components/SectionHeader";
import { EntriesTable } from "@/components/docket/EntriesTable";
import { Bar, Placeholder, TableSkeleton } from "@/components/Skeleton";
import type { ExportFormat } from "@/lib/export/entries";
import { listQuerySchema, type ListQuery } from "@/lib/validation/entry";
import {
  getEntryCounts,
  listEntries,
  type Entry,
  type EntryCounts,
} from "@/server/db/queries/applications";
import { requireScope } from "@/server/auth/session";

export const metadata: Metadata = { title: "Applications" };

/**
 * Every company written to, and nothing else.
 *
 * This is the half of the old docket that was a register. Lifting it out gave
 * it the whole width of the page, a filter row it never had room for, and a
 * heading that describes what is on screen rather than what could be done to
 * it.
 */
const EXPORT_LINKS: ReadonlyArray<{ format: ExportFormat; label: string; hint: string }> = [
  { format: "pdf", label: "PDF", hint: "The table as a printable page" },
  { format: "xlsx", label: "Excel", hint: "A workbook with typed columns, ready to open" },
  { format: "csv", label: "CSV", hint: "Plain text, for anything else" },
];

const TABS: ReadonlyArray<{
  filter: ListQuery["filter"];
  label: string;
  count: keyof EntryCounts;
}> = [
  { filter: "open", label: "In play", count: "open" },
  { filter: "rejected", label: "Filed", count: "rejected" },
  { filter: "all", label: "Everything", count: "total" },
];

/** The filter row. Links rather than buttons, so a view can be bookmarked. */
async function Tabs({ counts, query }: { counts: Promise<EntryCounts>; query: ListQuery }) {
  const totals = await counts;

  return (
    <nav className="tabs" aria-label="Filter the register">
      {TABS.map((tab) => (
        <Link
          key={tab.filter}
          href={{
            pathname: "/applications",
            query: {
              ...(query.q ? { q: query.q } : {}),
              ...(tab.filter !== "open" ? { filter: tab.filter } : {}),
            },
          }}
          className="tab"
          aria-current={query.filter === tab.filter ? "page" : undefined}
        >
          {tab.label}
          <span className="tab-count">{totals[tab.count]}</span>
        </Link>
      ))}
    </nav>
  );
}

/**
 * Hidden on an empty register, which is a fact only the count knows — so the
 * links wait for it. They sit at the end of a row that is already on screen,
 * and appearing there moves nothing, which is why this fallback is empty
 * rather than a shape.
 */
async function ExportLinks({ counts, query }: { counts: Promise<EntryCounts>; query: ListQuery }) {
  const { total } = await counts;
  if (total === 0) return null;

  /**
   * The search that is on screen is the search the file is taken through, so a
   * filtered register exports the rows the person is actually looking at.
   */
  const exportHref = (format: ExportFormat) => {
    const params = new URLSearchParams({ format });
    if (query.q) params.set("q", query.q);
    return `/docket/export?${params.toString()}`;
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="eyebrow text-muted">{query.q ? "Export these results" : "Export"}</span>
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

/** The rows themselves, and the four things it can mean to have none. */
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

  if (rows.length > 0) return <EntriesTable entries={rows} query={query} />;

  return (
    <div className="panel panel-pad rise text-center">
      <p className="eyebrow mb-2.5 text-stamp">Nothing here</p>
      <p className="text-base text-muted">
        {totals.total === 0 ? (
          <>
            Your register is empty.{" "}
            <Link href="/docket/new" className="border-b border-stamp text-ink">
              Stamp your first application
            </Link>
            , or{" "}
            <Link href="/docket/import" className="border-b border-stamp text-ink">
              import what you already have
            </Link>
            .
          </>
        ) : query.q ? (
          "No entry under this filter matches that search."
        ) : query.filter === "rejected" ? (
          "Nothing has been filed as rejected yet."
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

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const query = listQuerySchema.parse({
    q: typeof raw.q === "string" ? raw.q : undefined,
    sort: typeof raw.sort === "string" ? raw.sort : undefined,
    dir: typeof raw.dir === "string" ? raw.dir : undefined,
    filter: typeof raw.filter === "string" ? raw.filter : undefined,
  });

  /**
   * Started here, awaited inside the boundaries below. Both start from the same
   * session read, which is memoised per request, so two promises are still one
   * round trip for the session and one query each.
   */
  const counts = requireScope().then(getEntryCounts);
  const entries = requireScope().then((scope) =>
    listEntries(scope, {
      search: query.q,
      sort: query.sort,
      direction: query.dir,
      filter: query.filter,
    }),
  );

  return (
    <>
      <SectionHeader
        section="applications"
        aside={
          <Link href="/docket/new" className="btn">
            Stamp an application
          </Link>
        }
      />

      <div className="mt-6 flex flex-col gap-5">
        <Suspense
          fallback={
            <Placeholder label="the filters">
              <Bar className="h-9 w-64" />
            </Placeholder>
          }
        >
          <Tabs counts={counts} query={query} />
        </Suspense>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <form
            method="get"
            action="/applications"
            className="flex items-center gap-2"
            suppressHydrationWarning
          >
            <input
              type="search"
              name="q"
              defaultValue={query.q}
              className="min-w-60 rounded-lg border border-rule bg-sheet px-3.5 py-2 font-mono text-[13px] transition-colors focus:border-stamp focus:outline-none"
              placeholder="Search company, position, stack or city"
              aria-label="Search your applications"
              suppressHydrationWarning
            />
            <input type="hidden" name="sort" value={query.sort} />
            <input type="hidden" name="dir" value={query.dir} />
            <input type="hidden" name="filter" value={query.filter} />
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
            <ExportLinks counts={counts} query={query} />
          </Suspense>
        </div>

        <Suspense fallback={<TableSkeleton label="the register" />}>
          <Register entries={entries} counts={counts} query={query} />
        </Suspense>
      </div>
    </>
  );
}
