import { Fragment } from "react";
import Link from "next/link";

import type { Entry, SortDirection, SortField } from "@/server/db/queries/applications";
import { elapsed, protocolNumber } from "@/lib/format";
import { CompanyLogo } from "./CompanyLogo";
import { DossierTrigger } from "./DossierTrigger";
import { DeleteEntryButton } from "./DeleteEntryButton";
import { RejectionButton } from "./RejectionButton";
import { Stamp } from "./Stamp";

type Sort = { field: SortField; direction: SortDirection };

const COLUMNS: Array<{ field: SortField; label: string }> = [
  { field: "protocolNumber", label: "Nº" },
  { field: "company", label: "Company" },
  { field: "position", label: "Position" },
  { field: "stack", label: "Stack" },
  { field: "location", label: "City / country" },
  { field: "createdAt", label: "Stamped" },
];

/** Sorting is a link, not a handler: the register still sorts with JS turned off. */
function sortHref(search: string, current: Sort, field: SortField) {
  return {
    pathname: "/docket",
    query: {
      ...(search ? { q: search } : {}),
      sort: field,
      dir: current.field === field && current.direction === "asc" ? "desc" : "asc",
    },
  };
}

export function EntriesTable({
  entries,
  search,
  sort,
}: {
  entries: readonly Entry[];
  search: string;
  sort: Sort;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-rule shadow-elevation-1">
      <table className="docket-table">
        <thead className="sticky top-0 z-10 backdrop-blur-md" style={{ backgroundColor: 'var(--surface)' }}>
          <tr>
            {COLUMNS.map((column) => (
              <th
                key={column.field}
                aria-sort={
                  sort.field === column.field
                    ? sort.direction === "asc"
                      ? "ascending"
                      : "descending"
                    : "none"
                }
              >
                <Link href={sortHref(search, sort, column.field)} className="hover:text-stamp transition-colors">
                  {column.label}{" "}
                  {sort.field === column.field ? (
                    <span className="text-stamp">{sort.direction === "asc" ? "↑" : "↓"}</span>
                  ) : (
                    <span className="opacity-30">↕</span>
                  )}
                </Link>
              </th>
            ))}
            <th>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.length === 0 ? (
            <tr>
              <td colSpan={7} className="py-16 text-center">
                <p className="mb-2 font-mono text-sm uppercase tracking-wide text-muted">
                  {search ? "No entries match your search" : "Your docket is empty"}
                </p>
                {!search && (
                  <p className="text-sm text-faint">
                    <Link href="/docket" className="border-b border-stamp text-stamp">
                      Stamp your first application
                    </Link>{" "}
                    to get started
                  </p>
                )}
              </td>
            </tr>
          ) : (
            entries.map((entry) => (
              <Fragment key={entry.id}>
                <tr className={`group ${entry.notes ? "docket-row-with-note" : ""}`}>
                  <td className="docket-cell-number" data-label="Nº">
                    <span className="opacity-60 group-hover:opacity-100 transition-opacity">
                      {protocolNumber(entry.protocolNumber)}
                    </span>
                  </td>
                  <td className="font-semibold" data-label="Company">
                    <span className="flex items-center gap-3">
                      <CompanyLogo company={entry.company} website={entry.website} />
                      <DossierTrigger
                        id={entry.id}
                        label={`${entry.company} — ${entry.position}`}
                        className="font-semibold underline decoration-dotted underline-offset-4 hover:text-stamp transition-colors"
                      >
                        {entry.company}
                      </DossierTrigger>
                    </span>
                  </td>
                  <td className="text-sm text-muted" data-label="Position">
                    <span className="group-hover:text-ink transition-colors">
                      {entry.position}
                    </span>
                  </td>
                  <td data-label="Stack">
                    <div className="flex max-w-[260px] flex-wrap gap-1.5">
                      {entry.tags.slice(0, 3).map((tag) => (
                        <span 
                          key={tag} 
                          className="rounded border border-stamp-edge bg-stamp-wash px-2 py-0.5 font-mono text-[11px] text-stamp"
                        >
                          {tag}
                        </span>
                      ))}
                      {entry.tags.length > 3 && (
                        <span className="rounded border border-rule bg-card px-2 py-0.5 font-mono text-[11px] text-faint">
                          +{entry.tags.length - 3}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="text-sm text-muted" data-label="City / country">
                    {entry.city ? (
                      <>
                        <b className="block text-base font-semibold text-ink">{entry.city}</b>
                        <span className="text-xs">{entry.country}</span>
                      </>
                    ) : (
                      (entry.country ?? "—")
                    )}
                  </td>
                  <td data-label="Stamped">
                    <Stamp at={entry.createdAt} timezone={entry.timezone} />
                    <span className="mt-1.5 block font-mono text-[10px] text-faint">
                      {elapsed(entry.createdAt)}
                    </span>
                  </td>
                  <td data-label="Actions">
                    <span className="flex flex-wrap items-start gap-2.5 opacity-60 group-hover:opacity-100 transition-opacity">
                      <Link 
                        href={`/docket/${entry.id}/edit`} 
                        className="rounded px-2 py-1 font-mono text-[11px] uppercase tracking-wider text-stamp hover:bg-stamp-wash transition-colors"
                      >
                        Edit
                      </Link>
                      <RejectionButton id={entry.id} label={`${entry.company} — ${entry.position}`} />
                      <DeleteEntryButton id={entry.id} label={`${entry.company} — ${entry.position}`} />
                    </span>
                  </td>
                </tr>
                {entry.notes && (
                  <tr className="docket-note">
                    <td colSpan={7}>
                      <span className="eyebrow mb-1 block text-[10px] text-stamp">Notes</span>
                      <span className="text-sm">{entry.notes}</span>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
