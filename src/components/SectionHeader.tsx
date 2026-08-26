import type { ReactNode } from "react";

/**
 * The heading every gated section opens with, and the one place its words live.
 *
 * Two files render it: the page, and the `loading.tsx` beside the page. That is
 * the whole reason this exists — the loading boundary has to be able to say
 * which section it is without waiting for the server, and a heading copied into
 * two files drifts by the second edit.
 *
 * `aside` is whatever sits at the right-hand end: counters on the register and
 * the archive, the month nav on the calendar, nothing at all on settings. The
 * page passes the real one; the loading file passes its placeholder.
 */
export type SectionKey =
  "docket" | "board" | "calendar" | "archive" | "analytics" | "cv" | "import" | "settings";

export const SECTIONS: Record<SectionKey, { eyebrow: string; title: string; lede?: string }> = {
  docket: {
    eyebrow: "Personal register · kept by you",
    title: "Your docket",
    lede: "Every application gets a number and a stamp with the local date and time it was sent. The ones that ended in a refusal are kept in the archive.",
  },
  board: {
    eyebrow: "Proceedings",
    title: "Board",
    lede: "Every entry starts in the first column and moves right as the process advances. Drag a card, or use the selector on it — both do the same thing, and every move is written to the entry’s history. The last column files the entry as rejected and sends it to the archive.",
  },
  calendar: {
    eyebrow: "Hearings",
    title: "Calendar",
    lede: "The days you have to show up for. Subscribe once and every interview lands in Apple Calendar or Google Calendar with the alert you set.",
  },
  archive: {
    eyebrow: "Closed without an offer",
    title: "Archive",
    lede: "Applications that ended in a refusal. Nothing here is deleted — each one keeps its number, its stamp and its history, and reopens in one click if the answer changes.",
  },
  analytics: {
    eyebrow: "Findings",
    title: "Analytics",
    lede: "What the register says once there is enough of it. An entry counts as answered when it leaves the first column — the moment someone on the other side did something.",
  },
  cv: {
    eyebrow: "Preparation",
    title: "CV",
    lede: "One CV, read against one advert. The comparison names what the role asks for, what your CV already evidences and where the gaps are — then proposes changes you apply one at a time. Nothing is rewritten without you, and nothing you have not done is ever written in.",
  },
  import: {
    eyebrow: "Transfer of records",
    title: "Import",
    lede: "Bring in the CSV or JSON you exported from the prototype, from a spreadsheet, or from Docket itself. Company and position are required; everything else is optional.",
  },
  settings: {
    eyebrow: "Account",
    title: "Settings",
  },
};

export function SectionHeader({ section, aside }: { section: SectionKey; aside?: ReactNode }) {
  const { eyebrow, title, lede } = SECTIONS[section];

  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink pb-4">
      <div>
        <p className="eyebrow mb-1.5 text-stamp">{eyebrow}</p>
        <h1 className="text-[clamp(var(--text-2xl),5vw,var(--text-5xl))] leading-none font-bold tracking-[-0.025em]">
          {title}
        </h1>
        {lede && <p className="mt-2 max-w-[52ch] text-sm text-muted">{lede}</p>}
      </div>
      {aside}
    </header>
  );
}
