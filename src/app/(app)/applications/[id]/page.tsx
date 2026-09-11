import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CompanyLogo } from "@/components/docket/CompanyLogo";
import { DeleteEntryButton } from "@/components/docket/DeleteEntryButton";
import { PageTitleBeacon } from "@/components/shell/PageTitle";
import { RejectionButton } from "@/components/docket/RejectionButton";
import { Stamp } from "@/components/docket/Stamp";
import { Bar, Placeholder } from "@/components/Skeleton";
import { CV_ANALYSIS_ENABLED } from "@/lib/features";
import { elapsed, formatStamp, protocolNumber } from "@/lib/format";
import { requireScope } from "@/server/auth/session";
import { getEntryDossier, type EntryDossier } from "@/server/db/queries/applications";

export const metadata: Metadata = { title: "Entry" };

/**
 * One application, whole.
 *
 * This replaces the panel that used to open over a listing. A panel was the
 * right shape when the only thing worth reading was the advert; it is the wrong
 * shape for a page you arrive at straight after stamping an entry, want to send
 * to somebody, or want to keep open in a tab while writing a cover letter. A
 * page has a URL, a back button and room for the whole record — the panel had
 * none of the three.
 *
 * The layout is a brief: the account of the role on the left, the facts and the
 * things that can be done about them on the right, where they stay in reach
 * while a long advert is read.
 */
function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="sheet-block">
      <h2 className="eyebrow sheet-block-title">{title}</h2>
      {children}
    </section>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="sheet-fact-label">{label}</span>
      <span className="sheet-fact-value">{children}</span>
    </div>
  );
}

async function Sheet({ id }: { id: string }) {
  const scope = await requireScope();

  // Scoped, so another account's id and a deleted one both arrive here as null
  // — and both leave as the same 404. The two must stay indistinguishable.
  const entry: EntryDossier | null = await getEntryDossier(scope, id);
  if (!entry) notFound();

  const label = `${entry.company} — ${entry.position}`;
  const location = [entry.city, entry.country].filter(Boolean).join(", ");

  return (
    <>
      <PageTitleBeacon title={entry.company} />

      <header className="sheet-head">
        <div className="sheet-identity">
          <CompanyLogo company={entry.company} website={entry.website} />
          <div className="min-w-0">
            <p className="eyebrow text-stamp">Nº {protocolNumber(entry.protocolNumber)}</p>
            <h1 className="sheet-company">{entry.company}</h1>
            <p className="sheet-position">{entry.position}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-3">
          <Stamp
            at={entry.createdAt}
            timezone={entry.timezone}
            status={entry.stage}
            rejected={entry.rejectedAt != null}
            size={172}
          />
          <span className="font-mono text-[11px] text-faint">{elapsed(entry.createdAt)}</span>
        </div>
      </header>

      <div className="sheet-grid">
        <div>
          <Block title="Job description">
            {entry.jobDescription ? (
              <div className="sheet-advert">{entry.jobDescription}</div>
            ) : (
              <p className="text-sm text-muted">
                No advert was stored with this entry.{" "}
                <Link
                  href={`/applications/${entry.id}/edit`}
                  className="border-b border-stamp text-ink"
                >
                  Paste it in
                </Link>{" "}
                and the stack will be read from it.
              </p>
            )}
          </Block>

          {entry.notes && (
            <Block title="Notes">
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted">
                {entry.notes}
              </p>
            </Block>
          )}

          {entry.rejectionNote && (
            <Block title="What they said">
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted">
                {entry.rejectionNote}
              </p>
            </Block>
          )}

          {entry.interviews.length > 0 && (
            <Block title="Interviews">
              <ul className="timeline">
                {entry.interviews.map((interview) => {
                  const { date, time } = formatStamp(interview.startsAt, interview.timezone);
                  return (
                    <li key={interview.id}>
                      <span className="timeline-when">
                        {date} · {time} · {interview.durationMinutes} min
                      </span>
                      <span className="timeline-what">
                        {interview.title}
                        {interview.location ? ` — ${interview.location}` : ""}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Block>
          )}

          {entry.events.length > 0 && (
            <Block title="History">
              <ol className="timeline">
                {entry.events.map((event) => {
                  const { date, time } = formatStamp(event.occurredAt, entry.timezone);
                  return (
                    <li key={event.id}>
                      <span className="timeline-when">
                        {date} · {time}
                      </span>
                      <span className="timeline-what">
                        {event.stageName}
                        {event.note ? ` — ${event.note}` : ""}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </Block>
          )}
        </div>

        <aside className="sheet-aside">
          <div className="sheet-block">
            <p className="mb-4">
              {entry.rejectedAt ? (
                <span className="status-pill" data-tone="danger">
                  Rejected{entry.rejectedAtStage ? ` at ${entry.rejectedAtStage}` : ""}
                </span>
              ) : (
                <span className="status-pill">{entry.stage ?? "In play"}</span>
              )}
            </p>

            <div className="sheet-facts">
              <Fact label="City / country">{location || "—"}</Fact>
              <Fact label="Website">
                {entry.website ? (
                  <a
                    href={`https://${entry.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border-b border-stamp break-all"
                  >
                    {entry.website}
                  </a>
                ) : (
                  "—"
                )}
              </Fact>
              <Fact label="Stamped">{formatStamp(entry.createdAt, entry.timezone).date}</Fact>
              <Fact label="Waiting">{elapsed(entry.createdAt)}</Fact>
            </div>
          </div>

          {entry.tags.length > 0 && (
            <div className="sheet-block">
              <h2 className="eyebrow sheet-block-title">Stack</h2>
              <div className="flex flex-wrap gap-1.5">
                {entry.tags.map((tag, index) => (
                  <span
                    key={tag}
                    className="stack-chip"
                    style={{ "--rise-delay": `${index * 25}ms` } as React.CSSProperties}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* What the job asks for and what it gives, kept as two blocks. */}
          {entry.benefits.length > 0 && (
            <div className="sheet-block">
              <h2 className="eyebrow sheet-block-title">Benefits</h2>
              <div className="flex flex-wrap gap-1.5">
                {entry.benefits.map((benefit, index) => (
                  <span
                    key={benefit}
                    className="stack-chip"
                    style={{ "--rise-delay": `${index * 25}ms` } as React.CSSProperties}
                  >
                    {benefit}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="sheet-block">
            <h2 className="eyebrow sheet-block-title">Actions</h2>
            <div className="row-actions">
              <Link href={`/applications/${entry.id}/edit`} className="row-action">
                Edit this entry
              </Link>
              {!entry.rejectedAt && <RejectionButton id={entry.id} label={label} />}
              <DeleteEntryButton id={entry.id} label={label} redirectTo="/applications" />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted">
              The number and the stamp are not editable — they are the two facts the register
              asserts. Everything else about the role can be corrected.
            </p>
          </div>

          <div className="sheet-block">
            <h2 className="eyebrow sheet-block-title">Elsewhere</h2>
            <div className="flex flex-col gap-2 text-sm">
              <Link href="/board" className="link-quiet">
                See it on the board
              </Link>
              {CV_ANALYSIS_ENABLED && (
                <Link href="/cv" className="link-quiet">
                  Read your CV against this advert
                </Link>
              )}
              <Link href="/calendar" className="link-quiet">
                Schedule an interview
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

export default async function EntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <>
      <Link href="/applications" className="eyebrow text-muted hover:text-stamp">
        ← All applications
      </Link>

      <Suspense
        fallback={
          <Placeholder label="the entry" className="mt-6 flex flex-col gap-5">
            <Bar className="h-16 w-80" />
            <Bar className="h-64 w-full" />
          </Placeholder>
        }
      >
        <Sheet id={id} />
      </Suspense>
    </>
  );
}
