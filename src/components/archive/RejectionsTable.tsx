import { Fragment } from "react";
import Link from "next/link";

import type { Rejection } from "@/server/db/queries/rejections";
import { answerDelay, howFarItGot } from "@/lib/rejection";
import { protocolNumber } from "@/lib/format";
import { CompanyLogo } from "@/components/docket/CompanyLogo";
import { DeleteEntryButton } from "@/components/docket/DeleteEntryButton";
import { Stamp } from "@/components/docket/Stamp";
import { ReopenButton } from "./ReopenButton";

/**
 * The archive reads like the register, with two columns the register has no use
 * for: how far the application got, and when the answer came. Sorting is not
 * offered — an archive has one useful order, most recent refusal first, and a
 * sortable one would invite rereading it.
 */
export function RejectionsTable({ rejections }: { rejections: readonly Rejection[] }) {
  return (
    <table className="docket-table">
      <thead>
        <tr>
          <th>Nº</th>
          <th>Company</th>
          <th>Position</th>
          <th>Reached</th>
          <th>Filed</th>
          <th>
            <span className="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rejections.map((rejection) => (
          <Fragment key={rejection.id}>
            <tr className={rejection.rejectionNote ? "docket-row-with-note" : undefined}>
              <td className="docket-cell-number" data-label="Nº">
                {protocolNumber(rejection.protocolNumber)}
              </td>
              <td className="font-semibold" data-label="Company">
                <span className="flex items-center gap-3">
                  <CompanyLogo company={rejection.company} website={rejection.website} />
                  <span>{rejection.company}</span>
                </span>
              </td>
              <td className="text-sm text-muted" data-label="Position">
                {rejection.position}
                {rejection.tags.length > 0 && (
                  <span className="mt-2 flex max-w-[240px] flex-wrap gap-1.5">
                    {rejection.tags.slice(0, 4).map((tag) => (
                      <span key={tag} className="tag">
                        {tag}
                      </span>
                    ))}
                  </span>
                )}
              </td>
              <td className="text-sm text-muted" data-label="Reached">
                <b className="block text-base font-semibold text-ink">
                  {rejection.rejectedAtStage ?? "—"}
                </b>
                {howFarItGot(rejection.interviewCount)}
              </td>
              <td data-label="Filed">
                <Stamp at={rejection.rejectedAt} timezone={rejection.timezone} />
                <span className="mt-2 block font-mono text-[11px] text-muted">
                  {answerDelay(rejection.createdAt, rejection.rejectedAt)}
                </span>
              </td>
              <td data-label="Actions">
                <span className="flex flex-wrap items-center gap-3">
                  <Link href={`/docket/${rejection.id}/edit`} className="link-quiet">
                    Edit
                  </Link>
                  <ReopenButton
                    id={rejection.id}
                    label={`${rejection.company} — ${rejection.position}`}
                  />
                  <DeleteEntryButton
                    id={rejection.id}
                    label={`${rejection.company} — ${rejection.position}`}
                  />
                </span>
              </td>
            </tr>
            {rejection.rejectionNote && (
              <tr className="docket-note">
                <td colSpan={6}>
                  <span className="eyebrow mb-1 block text-[10px] text-stamp">What they said</span>
                  {rejection.rejectionNote}
                </td>
              </tr>
            )}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}
