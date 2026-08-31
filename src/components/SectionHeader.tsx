import type { ReactNode } from "react";

import { PageTitleBeacon } from "@/components/shell/PageTitle";

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
 *
 * The heading also hands its title to the bar above the page, which picks it up
 * as the heading scrolls out of sight. Both halves of that transition are
 * declared here so a section cannot end up with a title in one place and not
 * the other.
 */
export type SectionKey =
  | "docket"
  | "applications"
  | "new"
  | "board"
  | "calendar"
  | "archive"
  | "analytics"
  | "cv"
  | "import"
  | "settings";

export const SECTIONS: Record<SectionKey, { eyebrow: string; title: string; lede?: string }> = {
  docket: {
    eyebrow: "Personal register · kept by you",
    title: "Your docket",
    lede: "Where the search stands today, and the one thing worth doing next. Every application gets a number and a stamp with the local date and time it was sent.",
  },
  applications: {
    eyebrow: "Companies you have written to",
    title: "Applications",
    lede: "The full register, newest first. Every row opens onto the entry itself, and the ones that ended in a refusal are kept in the archive rather than deleted.",
  },
  new: {
    eyebrow: "Stamp an application",
    title: "New entry",
    lede: "Paste the link and the fields fill themselves in — everything a link wrote is highlighted until you have read it. The date and time are recorded for you.",
  },
  board: {
    eyebrow: "Proceedings",
    title: "Board",
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
    lede: "One CV, read against one advert. Nothing is rewritten without you, and nothing you have not done is ever written in.",
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

export function SectionHeader({
  section,
  aside,
  /** Sits under the title, in place of the section's own explanatory line. */
  children,
}: {
  section: SectionKey;
  aside?: ReactNode;
  children?: ReactNode;
}) {
  const { eyebrow, title, lede } = SECTIONS[section];

  return (
    <header className="page-head">
      <PageTitleBeacon title={title} />
      <div className="min-w-0">
        <p className="eyebrow page-eyebrow">{eyebrow}</p>
        <h1 className="page-title">{title}</h1>
        {(children ?? lede) && (
          <div className="page-lede">
            <div>{children ?? lede}</div>
          </div>
        )}
      </div>
      {aside}
    </header>
  );
}
