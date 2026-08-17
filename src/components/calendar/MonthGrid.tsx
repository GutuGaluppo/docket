import Link from "next/link";

import type { ScheduledInterview } from "@/server/db/queries/interviews";
import { CancelInterviewButton } from "./CancelInterviewButton";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Monday-first, because a working week is what this calendar is about. */
function gridStart(month: Date): Date {
  const first = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1));
  const weekday = (first.getUTCDay() + 6) % 7;
  first.setUTCDate(first.getUTCDate() - weekday);
  return first;
}

/** Calendar cells are plain dates, built at UTC midnight. */
const cellKey = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Which cell an interview belongs in, read in the zone it was scheduled in.
 * Bucketing by UTC would put a 09:00 Auckland interview on the day before.
 */
const localDayKey = (date: Date, timeZone: string | null) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: timeZone ?? "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

export function MonthGrid({
  month,
  interviews,
  today,
}: {
  month: Date;
  interviews: readonly ScheduledInterview[];
  today: Date;
}) {
  const start = gridStart(month);
  const days = Array.from({ length: 42 }, (_, i) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + i);
    return date;
  });

  const byDay = new Map<string, ScheduledInterview[]>();
  for (const item of interviews) {
    const key = localDayKey(item.startsAt, item.timezone);
    byDay.set(key, [...(byDay.get(key) ?? []), item]);
  }

  const thisMonth = month.getUTCMonth();
  const todayKey = cellKey(today);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[720px]">
        <div className="grid grid-cols-7 border-b-[1.5px] border-ink">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="px-2 py-2 font-mono text-[10px] tracking-[0.14em] text-muted uppercase"
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {days.map((date) => {
            const key = cellKey(date);
            const items = byDay.get(key) ?? [];
            const outside = date.getUTCMonth() !== thisMonth;
            const isToday = key === todayKey;

            return (
              <div
                key={key}
                className={`min-h-[104px] border-r border-b border-rule p-2 last:border-r-0 ${
                  outside ? "bg-paper" : "bg-card"
                }`}
              >
                <div className="mb-1.5 flex items-center gap-1.5">
                  <span
                    className={
                      isToday
                        ? "inline-flex size-5 items-center justify-center rounded-[2px] bg-stamp font-mono text-[11px] font-bold text-on-stamp"
                        : `font-mono text-[11px] ${outside ? "text-faint" : "text-muted"}`
                    }
                  >
                    {date.getUTCDate()}
                  </span>
                </div>

                <ul className="flex list-none flex-col gap-1">
                  {items.map((item) => (
                    <li key={item.id}>
                      <div className="rounded-[2px] border border-stamp-edge bg-stamp-wash p-1.5">
                        <p className="font-mono text-[10px] text-stamp">
                          {new Intl.DateTimeFormat("en-GB", {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                            timeZone: item.timezone ?? "UTC",
                          }).format(item.startsAt)}
                        </p>
                        <p className="text-xs leading-tight font-semibold">{item.company}</p>
                        <p className="text-[11px] leading-tight text-muted">{item.title}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <Link
                            href={`/calendar/event/${item.id}`}
                            prefetch={false}
                            className="font-mono text-[10px] tracking-[0.06em] text-stamp uppercase underline"
                          >
                            .ics
                          </Link>
                          <CancelInterviewButton id={item.id} label={item.title} />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
