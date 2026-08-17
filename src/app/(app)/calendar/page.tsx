import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";

import { MonthGrid } from "@/components/calendar/MonthGrid";
import { ScheduleForm } from "@/components/calendar/ScheduleForm";
import { SubscribeCard } from "@/components/calendar/SubscribeCard";
import { requireScope } from "@/server/auth/session";
import { getOrCreateCalendarToken, listInterviews } from "@/server/db/queries/interviews";
import { listEntries } from "@/server/db/queries/applications";
import { protocolNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Calendar" };

/** "2026-08" from the query string, or the current month. */
function parseMonth(value: string | undefined): Date {
  const match = value?.match(/^(\d{4})-(\d{2})$/);
  const now = new Date();
  if (!match) return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
}

const monthParam = (date: Date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

const shift = (month: Date, by: number) =>
  new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + by, 1));

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const scope = await requireScope();
  const { m } = await searchParams;
  const month = parseMonth(m);

  // The grid always shows six weeks, so the window has to reach past the month.
  const from = new Date(month);
  from.setUTCDate(from.getUTCDate() - 7);
  const to = shift(month, 1);
  to.setUTCDate(to.getUTCDate() + 14);

  const [interviews, entries, token, headerList] = await Promise.all([
    listInterviews(scope, { from, to }),
    listEntries(scope, { sort: "createdAt", direction: "desc" }),
    getOrCreateCalendarToken(scope),
    headers(),
  ]);

  const host = headerList.get("host") ?? "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const feedUrl = `${proto}://${host}/api/calendar/${token}.ics`;

  const options = entries.map((entry) => ({
    id: entry.id,
    label: `Nº ${protocolNumber(entry.protocolNumber)} · ${entry.company} — ${entry.position}`,
  }));

  const monthLabel = new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(month);

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink pb-4">
        <div>
          <p className="eyebrow mb-1.5 text-stamp">Hearings</p>
          <h1 className="text-[clamp(var(--text-2xl),5vw,var(--text-5xl))] leading-none font-bold tracking-[-0.025em]">
            Calendar
          </h1>
          <p className="mt-2 max-w-[52ch] text-sm text-muted">
            The days you have to show up for. Subscribe once and every interview lands in Apple
            Calendar or Google Calendar with the alert you set.
          </p>
        </div>
        <nav className="flex items-center gap-4 font-mono text-xs">
          <Link href={{ pathname: "/calendar", query: { m: monthParam(shift(month, -1)) } }}>
            ← Prev
          </Link>
          <span className="tracking-[0.08em] text-muted uppercase">{monthLabel}</span>
          <Link href={{ pathname: "/calendar", query: { m: monthParam(shift(month, 1)) } }}>
            Next →
          </Link>
        </nav>
      </header>

      <div className="mt-6 flex flex-col gap-6">
        <ScheduleForm applications={options} />
        <MonthGrid month={month} interviews={interviews} today={new Date()} />
        <SubscribeCard feedUrl={feedUrl} />
      </div>
    </>
  );
}
