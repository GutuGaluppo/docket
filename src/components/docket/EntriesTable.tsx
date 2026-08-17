import { Fragment } from "react";
import Link from "next/link";

import type { Entry, SortDirection, SortField } from "@/server/db/queries/applications";
import { elapsed, protocolNumber } from "@/lib/format";
import { CompanyLogo } from "./CompanyLogo";
import { DeleteEntryButton } from "./DeleteEntryButton";
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
    <table className="docket-table">
      <thead>
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
              <Link href={sortHref(search, sort, column.field)}>
                {column.label}{" "}
                {sort.field === column.field ? (sort.direction === "asc" ? "↑" : "↓") : ""}
              </Link>
            </th>
          ))}
          <th>
            <span className="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => (
          <Fragment key={entry.id}>
            <tr className={entry.notes ? "docket-row-with-note" : undefined}>
              <td className="docket-cell-number" data-label="Nº">
                {protocolNumber(entry.protocolNumber)}
              </td>
              <td className="font-semibold" data-label="Company">
                <span className="flex items-center gap-3">
                  <CompanyLogo company={entry.company} website={entry.website} />
                  <span>{entry.company}</span>
                </span>
              </td>
              <td className="text-sm text-muted" data-label="Position">
                {entry.position}
              </td>
              <td data-label="Stack">
                <div className="flex max-w-[260px] flex-wrap gap-1.5">
                  {entry.tags.map((tag) => (
                    <span key={tag} className="tag">
                      {tag}
                    </span>
                  ))}
                </div>
              </td>
              <td className="text-sm text-muted" data-label="City / country">
                {entry.city ? (
                  <>
                    <b className="block text-base font-semibold text-ink">{entry.city}</b>
                    {entry.country}
                  </>
                ) : (
                  (entry.country ?? "—")
                )}
              </td>
              <td data-label="Stamped">
                <Stamp at={entry.createdAt} timezone={entry.timezone} />
                <span className="mt-2 block font-mono text-[11px] text-muted">
                  {elapsed(entry.createdAt)}
                </span>
              </td>
              <td data-label="Actions">
                <DeleteEntryButton id={entry.id} label={`${entry.company} — ${entry.position}`} />
              </td>
            </tr>
            {entry.notes && (
              <tr className="docket-note">
                <td colSpan={7}>
                  <span className="eyebrow mb-1 block text-[10px] text-stamp">Notes</span>
                  {entry.notes}
                </td>
              </tr>
            )}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}
