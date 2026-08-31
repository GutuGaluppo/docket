import { Fragment } from "react";
import Link from "next/link";

import type { Entry, SortDirection, SortField } from "@/server/db/queries/applications";
import { elapsed, protocolNumber } from "@/lib/format";
import { CompanyLogo } from "./CompanyLogo";
import { DossierTrigger } from "./DossierTrigger";
import { DeleteEntryButton } from "./DeleteEntryButton";
import { RejectionButton } from "./RejectionButton";
import { StackCell } from "./StackCell";
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
    <div className="overflow-hidden rounded-xl border border-rule bg-card shadow-elevation-1">
      <table className="docket-table">
        <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur-md">
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
                <Link
                  href={sortHref(search, sort, column.field)}
                  className="transition-colors hover:text-stamp"
                >
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
          {entries.map((entry, index) => {
            const label = `${entry.company} — ${entry.position}`;

            return (
              <Fragment key={entry.id}>
                <tr
                  className={`group rise ${entry.notes ? "docket-row-with-note" : ""}`}
                  style={{ "--rise-delay": `${Math.min(index, 12) * 28}ms` } as React.CSSProperties}
                >
                  <td className="docket-cell-number" data-label="Nº">
                    <span className="opacity-60 transition-opacity group-hover:opacity-100">
                      {protocolNumber(entry.protocolNumber)}
                    </span>
                  </td>
                  <td className="font-semibold" data-label="Company">
                    <span className="flex items-center gap-3">
                      <CompanyLogo company={entry.company} website={entry.website} />
                      <DossierTrigger
                        id={entry.id}
                        label={label}
                        className="font-semibold underline decoration-dotted underline-offset-4 transition-colors hover:text-stamp"
                      >
                        {entry.company}
                      </DossierTrigger>
                    </span>
                  </td>
                  <td className="text-sm text-muted" data-label="Position">
                    <span className="transition-colors group-hover:text-ink">{entry.position}</span>
                  </td>
                  <td data-label="Stack">
                    <StackCell tags={entry.tags} label={label} />
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
                    <div className="row-actions">
                      <Link
                        href={`/docket/${entry.id}/edit`}
                        className="row-action"
                        aria-label={`Correct ${label}`}
                      >
                        <PencilGlyph />
                        Edit
                      </Link>
                      <RejectionButton id={entry.id} label={label} />
                      <DeleteEntryButton id={entry.id} label={label} />
                    </div>
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
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PencilGlyph() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
    >
      <path d="M11.2 2.3 13.7 4.8 5.6 12.9l-3.1.6.6-3.1z" />
    </svg>
  );
}
