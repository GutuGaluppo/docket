import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";

import { ProNotice } from "@/components/billing/ProNotice";
import { RateTable } from "@/components/analytics/RateTable";
import { Bar, Placeholder } from "@/components/Skeleton";
import { canUseAnalytics } from "@/server/billing/limits";
import { requireScope } from "@/server/auth/session";
import {
  getFunnel,
  getRateByCountry,
  getRateByTag,
  getSummary,
  type RateRow,
  type Summary,
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

/** Four figures and two tables' worth of ruled space, at their real weights. */
function FindingsSkeleton() {
  return (
    <Placeholder label="the findings" className="mt-6 flex flex-col gap-10">
      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="flex flex-col gap-2 border-t border-rule pt-3">
            <Bar className="h-7 w-16" />
            <Bar className="h-2 w-24" />
          </div>
        ))}
      </section>
      <section className="flex flex-col gap-3">
        <Bar className="h-2 w-28" />
        {Array.from({ length: 5 }, (_, index) => (
          <Bar key={index} className="h-6 w-full" />
        ))}
      </section>
    </Placeholder>
  );
}

type Report =
  | { allowed: false }
  | {
      allowed: true;
      summary: Summary;
      byTag: RateRow[];
      byCountry: RateRow[];
      funnel: Array<{ stage: string; n: number }>;
    };

async function Findings({ report }: { report: Promise<Report> }) {
  const data = await report;

  if (!data.allowed) {
    return (
      <div className="mt-6">
        <ProNotice limit="analytics" title="Response rates are a Pro feature">
          <p>
            The register keeps counting either way — every entry, stage change and interview is
            still recorded. What is behind Pro is the reading of it: response rate by technology, by
            country, and the time from stamp to first answer.
          </p>
        </ProNotice>
      </div>
    );
  }

  const { summary, byTag, byCountry, funnel } = data;

  if (summary.total === 0) {
    return (
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
    );
  }

  const busiest = Math.max(1, ...funnel.map((step) => step.n));

  return (
    <div className="mt-6 flex flex-col gap-10">
      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Figure
          value={summary.rate === null ? "—" : `${Math.round(summary.rate * 100)}%`}
          label="Response rate"
          hint={`${summary.responded} of ${summary.total} answered`}
        />
        <Figure
          value={summary.medianDaysToResponse === null ? "—" : `${summary.medianDaysToResponse}d`}
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
        Response rate by source of the ad is not here yet — the register does not record where you
        found the posting. It is the next column worth adding.
      </p>
    </div>
  );
}

export default function AnalyticsPage() {
  /**
   * The plan is checked before the queries run: the numbers are the feature, so
   * computing them and then declining to show them would be the wrong order.
   * What the check no longer decides is the heading — a page whose title waits
   * on a database read has nothing to put on screen while it waits.
   */
  const report: Promise<Report> = requireScope().then(async (scope) => {
    const verdict = await canUseAnalytics(scope);
    if (!verdict.allowed) return { allowed: false };

    const [summary, byTag, byCountry, funnel] = await Promise.all([
      getSummary(scope),
      getRateByTag(scope),
      getRateByCountry(scope),
      getFunnel(scope),
    ]);

    return { allowed: true, summary, byTag, byCountry, funnel };
  });

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

      <Suspense fallback={<FindingsSkeleton />}>
        <Findings report={report} />
      </Suspense>
    </>
  );
}
