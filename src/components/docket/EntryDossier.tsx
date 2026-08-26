"use client";

import { createContext, useCallback, useContext, useRef, useState, useTransition } from "react";
import Link from "next/link";

import { elapsed, formatStamp, protocolNumber } from "@/lib/format";
import { readEntryDossier } from "@/server/actions/entries";
import type { EntryDossier as Dossier } from "@/server/db/queries/applications";
import { CompanyLogo } from "./CompanyLogo";
import { Stamp } from "./Stamp";

/**
 * The dossier: one entry, opened over whatever was listing it.
 *
 * There is one dialog per screen, not one per card. Forty cards each holding a
 * closed dialog is forty copies of this markup in the document for a panel the
 * reader opens once, so the listings carry a button and the panel lives beside
 * them, filled in when it is asked for.
 *
 * Nothing is fetched until it opens. What the panel exists to show — the stored
 * job advert — is the one field a listing must not carry: it is capped at fifty
 * thousand characters, and sending every card's copy to the browser in advance
 * would cost megabytes to display none of them.
 */

type DossierContext = { open: (id: string) => void };

const Context = createContext<DossierContext | null>(null);

/**
 * Wraps a screen that lists entries. Server components pass straight through as
 * `children`, so the register's table stays on the server and only the button
 * inside it is client code.
 */
export function DossierProvider({ children }: { children: React.ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [entry, setEntry] = useState<Dossier | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const open = useCallback((id: string) => {
    setEntry(null);
    setError("");
    dialogRef.current?.showModal();
    startTransition(async () => {
      const result = await readEntryDossier({ id });
      if (result.ok) setEntry(result.entry);
      else setError(result.error);
    });
  }, []);

  const close = () => dialogRef.current?.close();

  return (
    <Context.Provider value={{ open }}>
      {children}

      <dialog
        ref={dialogRef}
        aria-labelledby="dossier-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        onClose={() => {
          setEntry(null);
          setError("");
        }}
        className="m-auto w-[min(94vw,760px)] rounded-[3px] border border-rule bg-card p-0 text-ink shadow-paper backdrop:bg-ink/55"
      >
        <DossierPanel entry={entry} error={error} pending={pending} onClose={close} />
      </dialog>
    </Context.Provider>
  );
}

/**
 * Returns null outside a provider rather than throwing, so a listing rendered
 * somewhere that has no panel degrades to a card that simply does not open.
 */
export function useDossier(): DossierContext | null {
  return useContext(Context);
}

/* -------------------------------------------------------------------------- */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-t border-dashed border-rule pt-4">
      <h3 className="eyebrow text-stamp">{title}</h3>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="eyebrow text-[10px] text-faint">{label}</span>
      <span className="text-sm text-ink">{children}</span>
    </div>
  );
}

function DossierPanel({
  entry,
  error,
  pending,
  onClose,
}: {
  entry: Dossier | null;
  error: string;
  pending: boolean;
  onClose: () => void;
}) {
  const location = entry ? [entry.city, entry.country].filter(Boolean).join(", ") : "";

  return (
    <div className="flex max-h-[86vh] flex-col">
      <header className="flex items-start justify-between gap-5 border-b border-rule p-6 pb-4 sm:px-8">
        <div className="min-w-0">
          <p className="font-mono text-xs text-muted">
            {entry ? `Nº ${protocolNumber(entry.protocolNumber)}` : "Nº ———"}
          </p>
          <h2
            id="dossier-title"
            className="mt-2 flex items-center gap-3 text-2xl font-bold tracking-[-0.02em]"
          >
            {entry && <CompanyLogo company={entry.company} website={entry.website} />}
            <span className="min-w-0 truncate">{entry?.company ?? "Reading the entry…"}</span>
          </h2>
          {entry && <p className="mt-1 text-sm text-muted">{entry.position}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="cursor-pointer p-1 font-mono text-xl leading-none text-muted hover:text-ink"
          suppressHydrationWarning
        >
          ×
        </button>
      </header>

      <div className="flex flex-col gap-4 overflow-y-auto p-6 sm:px-8" aria-live="polite">
        {error && <p className="font-mono text-xs text-flag">{error}</p>}

        {!entry && !error && (
          <p className="py-10 text-center font-mono text-xs text-faint">
            {pending ? "Reading the entry…" : "Nothing to show."}
          </p>
        )}

        {entry && (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Field label="Stage">
                {entry.rejectedAt ? (
                  <span className="text-flag">
                    Rejected{entry.rejectedAtStage ? ` at ${entry.rejectedAtStage}` : ""}
                  </span>
                ) : (
                  (entry.stage ?? "—")
                )}
              </Field>
              <Field label="City / country">{location || "—"}</Field>
              <Field label="Stamped">
                <Stamp at={entry.createdAt} timezone={entry.timezone} />
                <span className="mt-1 block font-mono text-[11px] text-muted">
                  {elapsed(entry.createdAt)}
                </span>
              </Field>
              <Field label="Website">
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
              </Field>
            </div>

            {entry.tags.length > 0 && (
              <Section title="Stack">
                <div className="flex flex-wrap gap-1.5">
                  {entry.tags.map((tag) => (
                    <span key={tag} className="tag">
                      {tag}
                    </span>
                  ))}
                </div>
              </Section>
            )}

            {entry.rejectionNote && (
              <Section title="What they said">
                <p className="text-sm whitespace-pre-wrap text-muted">{entry.rejectionNote}</p>
              </Section>
            )}

            {entry.notes && (
              <Section title="Notes">
                <p className="text-sm whitespace-pre-wrap text-muted">{entry.notes}</p>
              </Section>
            )}

            {/* The reason this panel exists. Kept verbatim, scrolling inside its
                own box: a job advert is long, and the rest of the dossier must
                not be pushed off the screen by it. */}
            <Section title="Job description">
              {entry.jobDescription ? (
                <div className="max-h-[38vh] overflow-y-auto rounded-[2px] border border-rule bg-sheet p-4">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-ink">
                    {entry.jobDescription}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted">
                  No advert was stored with this entry.{" "}
                  <Link
                    href={`/docket/${entry.id}/edit`}
                    className="border-b border-stamp text-ink"
                    onClick={onClose}
                  >
                    Paste it in
                  </Link>{" "}
                  and it will be here next time.
                </p>
              )}
            </Section>

            {entry.interviews.length > 0 && (
              <Section title="Interviews">
                <ul className="flex flex-col gap-2">
                  {entry.interviews.map((interview) => {
                    const { date, time } = formatStamp(interview.startsAt, interview.timezone);
                    return (
                      <li key={interview.id} className="flex flex-wrap items-baseline gap-x-3">
                        <span className="font-mono text-xs text-stamp">
                          {date} {time}
                        </span>
                        <span className="text-sm text-ink">{interview.title}</span>
                        <span className="font-mono text-[11px] text-muted">
                          {interview.durationMinutes} min
                          {interview.location ? ` · ${interview.location}` : ""}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </Section>
            )}

            {entry.events.length > 0 && (
              <Section title="History">
                <ol className="flex flex-col gap-2">
                  {entry.events.map((event) => {
                    const { date, time } = formatStamp(event.occurredAt, entry.timezone);
                    return (
                      <li key={event.id} className="flex flex-wrap items-baseline gap-x-3">
                        <span className="font-mono text-xs text-muted">
                          {date} {time}
                        </span>
                        <span className="text-sm text-ink">{event.stageName}</span>
                        {event.note && (
                          <span className="font-mono text-[11px] text-faint">{event.note}</span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </Section>
            )}
          </>
        )}
      </div>

      {entry && (
        <footer className="flex flex-wrap items-center gap-4 border-t border-rule p-6 py-4 sm:px-8">
          <Link href={`/docket/${entry.id}/edit`} className="btn btn-quiet" onClick={onClose}>
            Edit this entry
          </Link>
          <button type="button" onClick={onClose} className="link-quiet" suppressHydrationWarning>
            Close
          </button>
        </footer>
      )}
    </div>
  );
}
