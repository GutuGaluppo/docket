"use client";

import { POSTING_FIELDS, type PostingField, type PostingSource } from "@/lib/posting/types";

const LABELS: Record<PostingField, string> = {
  company: "Company",
  website: "Website",
  position: "Position",
  city: "City",
  country: "Country",
  jobDescription: "Job description",
};

/**
 * The notice that stands between a link and a stamped entry.
 *
 * A register is only worth keeping if every line in it was put there on
 * purpose. Reading a link is a convenience, and a convenience that files
 * paperwork on its own is how a register fills up with things nobody checked —
 * a mangled title, a company name lifted from a cookie banner, a city that
 * belonged to a different advert on the same page.
 *
 * So the machine's work arrives marked and named: which fields it touched,
 * where it read them, and a mark on each one that only comes off when the field
 * is edited or the entry is stamped. Nothing is blocked and nothing is nagged —
 * the person can stamp immediately if the draft is right. The mark exists so
 * that "I read it" and "I did not notice" stop looking the same.
 */
export function DraftReview({
  filled,
  sources,
  onAccept,
}: {
  filled: readonly PostingField[];
  sources: readonly PostingSource[];
  onAccept: () => void;
}) {
  if (filled.length === 0) return null;

  const ordered = POSTING_FIELDS.filter((field) => filled.includes(field));
  const where = sources.length > 0 ? sources.join(", ") : "the page";

  return (
    <div role="status" className="review-note mb-5">
      <p className="eyebrow mb-1.5 text-mark-ink">Filled from the link — check it</p>

      <p className="text-sm leading-relaxed text-ink">
        {ordered.length === 1 ? "One field was" : `${ordered.length} fields were`} written from{" "}
        <strong>{where}</strong>, not by you. Read {ordered.length === 1 ? "it" : "them"} before
        stamping — the highlight comes off each field as soon as you edit it.
      </p>

      <ul className="mt-2.5 flex list-none flex-wrap gap-x-4 gap-y-1 p-0">
        {ordered.map((field) => (
          <li key={field} className="mark-flag">
            {LABELS[field]}
          </li>
        ))}
      </ul>

      <button type="button" className="link-quiet mt-3" onClick={onAccept}>
        Looks right — clear the marks
      </button>
    </div>
  );
}
