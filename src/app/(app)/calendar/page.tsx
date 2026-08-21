import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { headers } from "next/headers";

import { SectionHeader } from "@/components/SectionHeader";
import { MonthGrid } from "@/components/calendar/MonthGrid";
import { ScheduleForm } from "@/components/calendar/ScheduleForm";
import { SubscribeCard } from "@/components/calendar/SubscribeCard";
import { Bar, MonthSkeleton, Placeholder } from "@/components/Skeleton";
import { requireScope } from "@/server/auth/session";
import {
  getOrCreateCalendarToken,
  listInterviews,
  type ScheduledInterview,
} from "@/server/db/queries/interviews";
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

type Option = { id: string; label: string };

/**
 * The form waits only for the list of entries it offers. The month grid behind
 * it and the subscription card below it are three separate waits, so whichever
 * query answers first is on screen first.
 */
async function Schedule({ options }: { options: Promise<Option[]> }) {
  return <ScheduleForm applications={await options} />;
}

async function Month({
  month,
  interviews,
}: {
  month: Date;
  interviews: Promise<ScheduledInterview[]>;
}) {
  return <MonthGrid month={month} interviews={await interviews} today={new Date()} />;
}

async function Subscribe({ feedUrl }: { feedUrl: Promise<string> }) {
  return <SubscribeCard feedUrl={await feedUrl} />;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { m } = await searchParams;
  const month = parseMonth(m);

  // The grid always shows six weeks, so the window has to reach past the month.
  const from = new Date(month);
  from.setUTCDate(from.getUTCDate() - 7);
  const to = shift(month, 1);
  to.setUTCDate(to.getUTCDate() + 14);

  const interviews = requireScope().then((scope) => listInterviews(scope, { from, to }));

  const options: Promise<Option[]> = requireScope()
    .then((scope) => listEntries(scope, { sort: "createdAt", direction: "desc" }))
    .then((entries) =>
      entries.map((entry) => ({
        id: entry.id,
        label: `Nº ${protocolNumber(entry.protocolNumber)} · ${entry.company} — ${entry.position}`,
      })),
    );

  const feedUrl: Promise<string> = requireScope().then(async (scope) => {
    const [token, headerList] = await Promise.all([getOrCreateCalendarToken(scope), headers()]);
    const host = headerList.get("host") ?? "localhost:3000";
    const proto =
      headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    return `${proto}://${host}/api/calendar/${token}.ics`;
  });

  const monthLabel = new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(month);

  return (
    <>
      {/* The month and its arrows come from the query string, not the
          database, so the calendar can be paged before anything has loaded. */}
      <SectionHeader
        section="calendar"
        aside={
          <nav className="flex items-center gap-4 font-mono text-xs">
            <Link href={{ pathname: "/calendar", query: { m: monthParam(shift(month, -1)) } }}>
              ← Prev
            </Link>
            <span className="tracking-[0.08em] text-muted uppercase">{monthLabel}</span>
            <Link href={{ pathname: "/calendar", query: { m: monthParam(shift(month, 1)) } }}>
              Next →
            </Link>
          </nav>
        }
      />

      <div className="mt-6 flex flex-col gap-6">
        <Suspense
          fallback={
            <Placeholder label="the entries to schedule against" className="flex flex-col gap-3">
              <Bar className="h-3 w-32" />
              <Bar className="h-10 w-full" />
            </Placeholder>
          }
        >
          <Schedule options={options} />
        </Suspense>

        <Suspense fallback={<MonthSkeleton />}>
          <Month month={month} interviews={interviews} />
        </Suspense>

        <Suspense
          fallback={
            <Placeholder label="the subscription link" className="flex items-center gap-3">
              <Bar className="h-9 w-44" />
              <Bar className="h-3 w-56" />
            </Placeholder>
          }
        >
          <Subscribe feedUrl={feedUrl} />
        </Suspense>
      </div>
    </>
  );
}
