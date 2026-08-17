import type { Metadata } from "next";
import Link from "next/link";

import { RateTable } from "@/components/analytics/RateTable";
import { requireScope } from "@/server/auth/session";
import {
  getFunnel,
  getRateByCountry,
  getRateByTag,
  getSummary,
} from "@/server/db/queries/analytics";

export const metadata: Metadata = { title: "Analytics" };

/**
 * A figure that carries its own caveat. Null reads as "—", never as zero: with
 * nothing sent yet, "0% response rate" is a claim the data does not support.
 */
function Figure({ value, label, hint }: { value: string; label: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 border-t border-rule pt-3">
      <b className="font-mono text-3xl leading-none font-bold tabular-nums">{value}</b>
      <span className="font-mono text-[10px] tracking-[0.14em] text-muted uppercase">{label}</span>
      {hint && <span className="text-xs text-faint">{hint}</span>}
    </div>
  );
}

export default async function AnalyticsPage() {
  const scope = await requireScope();
  const [summary, byTag, byCountry, funnel] = await Promise.all([
    getSummary(scope),
    getRateByTag(scope),
    getRateByCountry(scope),
    getFunnel(scope),
  ]);

  const busiest = Math.max(1, ...funnel.map((step) => step.n));

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink pb-4">
        <div>
          <p className="eyebrow mb-1.5 text-stamp">Findings</p>
          <h1 className="text-[clamp(var(--text-2xl),5vw,var(--text-5xl))] leading-none font-bold tracking-[-0.025em]">
            Analytics
          </h1>
          <p className="mt-2 max-w-[54ch] text-sm text-muted">
            What the register says once there is enough of it. An entry counts as answered when it
            leaves the first column — the moment someone on the other side did something.
          </p>
        </div>
      </header>

      {summary.total === 0 ? (
        <div className="mt-6 rounded-[3px] border border-dashed border-rule bg-card px-6 py-12 text-center">
          <p className="eyebrow mb-2.5 text-stamp">Nothing to measure</p>
          <p className="text-base text-muted">
            Rates need a denominator.{" "}
            <Link href="/docket" className="border-b border-stamp text-ink">
              Stamp an application
            </Link>{" "}
            and this page starts filling in.
          </p>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-10">
          <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Figure
              value={summary.rate === null ? "—" : `${Math.round(summary.rate * 100)}%`}
              label="Response rate"
              hint={`${summary.responded} of ${summary.total} answered`}
            />
            <Figure
              value={
                summary.medianDaysToResponse === null ? "—" : `${summary.medianDaysToResponse}d`
              }
              label="Median wait"
              hint="Until the first reply, for the ones that replied"
            />
            <Figure
              value={String(summary.stillWaiting).padStart(2, "0")}
              label="Still waiting"
              hint="No reply yet"
            />
            <Figure
              value={String(summary.interviewsScheduled).padStart(2, "0")}
              label="Interviews booked"
            />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="eyebrow text-muted">Where they sit</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <caption className="sr-only">Number of entries in each board column.</caption>
                <tbody>
                  {funnel.map((step) => (
                    <tr key={step.stage}>
                      <th
                        scope="row"
                        className="w-px border-b border-rule py-2.5 pr-4 text-left font-normal whitespace-nowrap"
                      >
                        {step.stage}
                      </th>
                      <td className="border-b border-rule py-2.5">
                        <span className="flex items-center gap-2.5">
                          <span
                            aria-hidden="true"
                            className="h-2 min-w-[80px] flex-1 overflow-hidden rounded-[2px] bg-stamp-wash"
                          >
                            <span
                              className="block h-full rounded-[2px] bg-stamp"
                              style={{ width: `${(step.n / busiest) * 100}%` }}
                            />
                          </span>
                          <span className="w-8 shrink-0 text-right font-mono text-xs tabular-nums">
                            {step.n}
                          </span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid gap-10 lg:grid-cols-2">
            <RateTable caption="By stack" unit="Technology" rows={byTag} />
            <RateTable caption="By country" unit="Country" rows={byCountry} />
          </div>

          <p className="max-w-[64ch] font-mono text-[11px] leading-relaxed text-faint">
            Response rate by source of the ad is not here yet — the register does not record where
            you found the posting. It is the next column worth adding.
          </p>
        </div>
      )}
    </>
  );
}
