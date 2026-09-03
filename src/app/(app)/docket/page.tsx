import type { Metadata, Route } from "next";
import { Suspense } from "react";
import Link from "next/link";

import { SectionHeader } from "@/components/SectionHeader";
import { SectionIcon, type IconName } from "@/components/shell/SectionIcon";
import { CompanyLogo } from "@/components/docket/CompanyLogo";
import { Stamp } from "@/components/docket/Stamp";
import { Bar, Placeholder } from "@/components/Skeleton";
import { elapsed, protocolNumber } from "@/lib/format";
import {
  getEntryCounts,
  listEntries,
  type Entry,
  type EntryCounts,
} from "@/server/db/queries/applications";
import { getSession, requireScope } from "@/server/auth/session";

export const metadata: Metadata = { title: "Your docket" };

/**
 * The desk, not the register.
 *
 * Splitting the two was the point: this page answers "where does the search
 * stand, and what should I do next", and the list of every company written to
 * answers "what have I done". They were one screen, and the form for adding an
 * entry sat on top of fifty rows nobody could see past.
 *
 * Nothing here is a new query. The counts and the newest few rows are the same
 * two reads the register already made, so the split costs a route, not a round
 * trip.
 */
const SUGGESTIONS: ReadonlyArray<{
  href: Route;
  icon: IconName;
  title: string;
  note: string;
}> = [
  {
    href: "/docket/new",
    icon: "plus",
    title: "Stamp an application",
    note: "Paste the link and the fields fill themselves in. Takes under a minute.",
  },
  {
    href: "/cv",
    icon: "cv",
    title: "Tailor your CV",
    note: "Read one CV against one advert and see exactly what the role asks for.",
  },
  {
    href: "/board",
    icon: "board",
    title: "Move the board along",
    note: "Anything waiting on you is a column away from where it should be.",
  },
  {
    href: "/analytics",
    icon: "analytics",
    title: "See where they go",
    note: "Response rates by stack and country, and a map of every city you wrote to.",
  },
];

/**
 * The greeting. It uses whatever name the provider gave, and quietly does
 * without one otherwise — "Welcome back, null" is worse than no name at all.
 */
async function Welcome({ counts }: { counts: Promise<EntryCounts> }) {
  const [session, totals] = await Promise.all([getSession(), counts]);
  const first = (session?.user?.name ?? "").trim().split(" ")[0];

  return (
    <div className="hero">
      <span aria-hidden="true" className="hero-mark">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="h-7 w-7"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 6.5A2.5 2.5 0 0 1 6.5 4H17l3 3v12.5A1.5 1.5 0 0 1 18.5 21h-12A2.5 2.5 0 0 1 4 18.5Z"
          />
          <path strokeLinecap="round" d="M8 10h8M8 14h5" />
        </svg>
      </span>
      <div className="hero-body">
        <p className="hero-title">
          {first ? `Welcome back, ${first}.` : "Welcome back."}{" "}
          {totals.total === 0
            ? "Your register is empty — the first stamp is the hard one."
            : totals.open === 0
              ? "Nothing is waiting on an answer right now."
              : `${totals.open} application${totals.open === 1 ? " is" : "s are"} still waiting on an answer.`}
        </p>
        <p className="hero-note">
          Every application gets a number and a stamp with the local date and time it was sent.
          Nothing is ever deleted on your behalf — a refusal moves an entry to the archive, where it
          keeps its number and reopens in one click.
        </p>
      </div>
    </div>
  );
}

async function Figures({ counts }: { counts: Promise<EntryCounts> }) {
  const totals = await counts;

  const figures: ReadonlyArray<{ value: number; label: string; href?: Route }> = [
    { value: totals.total, label: "In total", href: "/applications" },
    { value: totals.open, label: "Awaiting an answer", href: "/applications" },
    { value: totals.thisMonth, label: "This month" },
    { value: totals.rejected, label: "Filed", href: "/archive" },
  ];

  return (
    <section className="grid gap-3.5 grid-cols-[repeat(auto-fit,minmax(160px,1fr))]">
      {figures.map((figure, index) => {
        const body = (
          <>
            <b className="stat-value">{String(figure.value).padStart(2, "0")}</b>
            <span className="stat-label">{figure.label}</span>
          </>
        );
        const style = { "--rise-delay": `${index * 55}ms` } as React.CSSProperties;

        return figure.href ? (
          <Link key={figure.label} href={figure.href} className="stat lift rise" style={style}>
            {body}
          </Link>
        ) : (
          <div key={figure.label} className="stat rise" style={style}>
            {body}
          </div>
        );
      })}
    </section>
  );
}

/** How many of the newest entries the desk shows before handing over to the register. */
const LATEST = 5;

/** The last handful stamped, as a way back into the entries rather than a list. */
async function Latest({ entries }: { entries: Promise<Entry[]> }) {
  const all = await entries;
  const rows = all.slice(0, LATEST);

  if (rows.length === 0) {
    return (
      <div className="panel panel-pad text-center">
        <p className="eyebrow mb-2.5 text-stamp">Blank register</p>
        <p className="text-sm text-muted">
          Nothing has been stamped yet.{" "}
          <Link href="/docket/new" className="border-b border-stamp text-ink">
            Record your first application
          </Link>
          , or{" "}
          <Link href="/docket/import" className="border-b border-stamp text-ink">
            import what you already have
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((entry, index) => (
        <Link
          key={entry.id}
          href={`/applications/${entry.id}`}
          className="panel lift rise flex items-center gap-4 px-4 py-3.5 no-underline"
          style={{ "--rise-delay": `${index * 45}ms` } as React.CSSProperties}
        >
          <span className="font-mono text-[11px] text-faint">
            {protocolNumber(entry.protocolNumber)}
          </span>
          <CompanyLogo company={entry.company} website={entry.website} />
          <span className="min-w-0 flex-1">
            <b className="block truncate text-sm font-semibold">{entry.company}</b>
            <span className="block truncate text-xs text-muted">{entry.position}</span>
          </span>
          <span className="hidden font-mono text-[11px] text-faint sm:block">
            {elapsed(entry.createdAt)}
          </span>
          <span className="hidden md:block">
            <Stamp at={entry.createdAt} timezone={entry.timezone} status={entry.stage} size={104} />
          </span>
        </Link>
      ))}
    </div>
  );
}

export default function DocketPage() {
  /**
   * Started here, awaited inside the boundaries below. Nothing on this page's
   * own path touches the database, so the heading and the suggestions are on
   * screen while these are still in flight.
   */
  const counts = requireScope().then(getEntryCounts);
  const entries = requireScope().then((scope) => listEntries(scope, { filter: "all" }));

  return (
    <>
      <SectionHeader section="docket" />

      <div className="mt-7 flex flex-col gap-9">
        <Suspense
          fallback={
            <Placeholder label="the greeting">
              <Bar className="h-24 w-full" />
            </Placeholder>
          }
        >
          <Welcome counts={counts} />
        </Suspense>

        <Suspense
          fallback={
            <Placeholder
              label="the counters"
              className="grid gap-3.5 grid-cols-[repeat(auto-fit,minmax(160px,1fr))]"
            >
              <Bar className="h-21.5 w-full" />
              <Bar className="h-21.5 w-full" />
              <Bar className="h-21.5 w-full" />
              <Bar className="h-21.5 w-full" />
            </Placeholder>
          }
        >
          <Figures counts={counts} />
        </Suspense>

        <section className="flex flex-col gap-3.5">
          <h2 className="eyebrow text-muted">Suggested for you</h2>
          <div className="suggest-grid">
            {SUGGESTIONS.map((suggestion, index) => (
              <Link
                key={suggestion.href}
                href={suggestion.href}
                className="suggest-card lift rise"
                style={{ "--rise-delay": `${index * 60}ms` } as React.CSSProperties}
              >
                <span aria-hidden="true" className="suggest-icon">
                  <SectionIcon name={suggestion.icon} />
                </span>
                <span className="suggest-title">{suggestion.title}</span>
                <span className="suggest-note">{suggestion.note}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3.5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="eyebrow text-muted">Latest entries</h2>
            <Link href="/applications" className="link-quiet">
              See all applications
            </Link>
          </div>
          <Suspense
            fallback={
              <Placeholder label="the latest entries" className="flex flex-col gap-2.5">
                <Bar className="h-14 w-full" />
                <Bar className="h-14 w-full" />
                <Bar className="h-14 w-full" />
              </Placeholder>
            }
          >
            <Latest entries={entries} />
          </Suspense>
        </section>
      </div>
    </>
  );
}
