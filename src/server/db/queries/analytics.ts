import "server-only";

import { and, count, eq, isNotNull, ne, sql } from "drizzle-orm";

import { db } from "@/server/db";
import {
  applications,
  applicationTags,
  interviews,
  stages,
  statusEvents,
} from "@/server/db/schema";
import type { Scope } from "./scope";

/**
 * "Responded" means the entry left the first column — someone on the other side
 * did something. It is read from status_events rather than from the cached
 * stage on the application, so an entry that advanced and later came back still
 * counts as having had a reply. That is the honest reading of the question
 * "did they answer?".
 */
const responded = sql`exists (
  select 1
    from ${statusEvents} e
    join ${stages} s on s.id = e.stage_id
   where e.application_id = ${applications}."id"
     and s.kind <> 'start'
)`;

/** When that first reply landed, for the waiting-time figures. */
const firstResponseAt = sql`(
  select min(e.occurred_at)
    from ${statusEvents} e
    join ${stages} s on s.id = e.stage_id
   where e.application_id = ${applications}."id"
     and s.kind <> 'start'
)`;

export type Summary = {
  total: number;
  responded: number;
  /** Null rather than zero when there is nothing to divide — 0% is a claim. */
  rate: number | null;
  medianDaysToResponse: number | null;
  interviewsScheduled: number;
  stillWaiting: number;
};

export async function getSummary(scope: Scope): Promise<Summary> {
  const [row] = await db
    .select({
      total: count(),
      responded: sql<number>`count(*) filter (where ${responded})`,
      medianDays: sql<number | null>`percentile_cont(0.5) within group (
        order by extract(epoch from (${firstResponseAt} - ${applications.createdAt})) / 86400
      ) filter (where ${responded})`,
    })
    .from(applications)
    .where(scope.owned(applications.userId));

  const [booked] = await db
    .select({ n: count() })
    .from(interviews)
    .innerJoin(applications, eq(interviews.applicationId, applications.id))
    .where(scope.owned(applications.userId));

  const total = Number(row?.total ?? 0);
  const answered = Number(row?.responded ?? 0);
  const median = row?.medianDays;

  return {
    total,
    responded: answered,
    rate: total > 0 ? answered / total : null,
    medianDaysToResponse: median == null ? null : Math.round(Number(median) * 10) / 10,
    interviewsScheduled: Number(booked?.n ?? 0),
    stillWaiting: total - answered,
  };
}

export type RateRow = {
  label: string;
  total: number;
  responded: number;
  rate: number;
};

/**
 * Ranked by rate, but the count travels with every row. A 100% response rate
 * from one application is noise, and a table that hides the denominator invites
 * exactly that mistake — the UI dims rows below the threshold rather than
 * dropping them, because a small sample is still information.
 */
export const RELIABLE_SAMPLE = 3;

export async function getRateByTag(scope: Scope, limit = 12): Promise<RateRow[]> {
  const rows = await db
    .select({
      label: applicationTags.tag,
      total: count(),
      responded: sql<number>`count(*) filter (where ${responded})`,
    })
    .from(applicationTags)
    .innerJoin(applications, eq(applicationTags.applicationId, applications.id))
    .where(scope.owned(applications.userId))
    .groupBy(applicationTags.tag)
    .orderBy(sql`count(*) desc`)
    .limit(limit);

  return rows
    .map((r) => ({
      label: r.label,
      total: Number(r.total),
      responded: Number(r.responded),
      rate: Number(r.total) > 0 ? Number(r.responded) / Number(r.total) : 0,
    }))
    .sort((a, b) => b.rate - a.rate || b.total - a.total);
}

export async function getRateByCountry(scope: Scope, limit = 12): Promise<RateRow[]> {
  const rows = await db
    .select({
      label: applications.country,
      total: count(),
      responded: sql<number>`count(*) filter (where ${responded})`,
    })
    .from(applications)
    .where(
      scope.owned(
        applications.userId,
        and(isNotNull(applications.country), ne(applications.country, "")),
      ),
    )
    .groupBy(applications.country)
    .orderBy(sql`count(*) desc`)
    .limit(limit);

  return rows
    .map((r) => ({
      label: r.label ?? "—",
      total: Number(r.total),
      responded: Number(r.responded),
      rate: Number(r.total) > 0 ? Number(r.responded) / Number(r.total) : 0,
    }))
    .sort((a, b) => b.rate - a.rate || b.total - a.total);
}

/** Where the entries currently sit, in board order. */
export async function getFunnel(scope: Scope): Promise<Array<{ stage: string; n: number }>> {
  const rows = await db
    .select({
      stage: stages.name,
      position: stages.position,
      n: sql<number>`count(${applications}."id")`,
    })
    .from(stages)
    .leftJoin(applications, eq(applications.stageId, stages.id))
    .where(scope.owned(stages.userId))
    .groupBy(stages.id, stages.name, stages.position)
    .orderBy(sql`${stages.position} asc`);

  return rows.map((r) => ({ stage: r.stage, n: Number(r.n) }));
}

/**
 * One application, reduced to what a pin on the map has to be able to name.
 *
 * Deliberately narrow. A country with forty entries in it would otherwise put
 * forty job adverts into the page's payload to show forty company names.
 */
export type PlacedEntry = {
  id: string;
  protocolNumber: number;
  company: string;
  position: string;
  stage: string | null;
  rejected: boolean;
};

/** Every entry that names somewhere, grouped by the somewhere it names. */
export type Place = {
  city: string | null;
  country: string;
  entries: PlacedEntry[];
};

/**
 * The register as places rather than as rows.
 *
 * Grouping happens here rather than in SQL because the grouping key is a pair
 * that may be half-null — an entry can name a country and no city — and because
 * the rows are wanted anyway: the point of clicking a pin is to read which
 * applications are behind it, so fetching counts first and details second would
 * be two round trips for one question.
 */
export async function getPlaces(scope: Scope): Promise<Place[]> {
  const rows = await db
    .select({
      id: applications.id,
      protocolNumber: applications.protocolNumber,
      company: applications.company,
      position: applications.position,
      city: applications.city,
      country: applications.country,
      rejectedAt: applications.rejectedAt,
      stage: sql<
        string | null
      >`(select s.name from ${stages} s where s.id = ${applications.stageId})`,
    })
    .from(applications)
    .where(
      scope.owned(
        applications.userId,
        and(isNotNull(applications.country), ne(applications.country, "")),
      ),
    )
    .orderBy(sql`${applications.protocolNumber} desc`);

  const grouped = new Map<string, Place>();

  for (const row of rows) {
    const country = row.country ?? "";
    if (!country) continue;
    const city = row.city || null;
    const key = `${city ?? ""}|${country}`;

    const place = grouped.get(key) ?? { city, country, entries: [] };
    place.entries.push({
      id: row.id,
      protocolNumber: row.protocolNumber,
      company: row.company,
      position: row.position,
      stage: row.stage,
      rejected: row.rejectedAt !== null,
    });
    grouped.set(key, place);
  }

  return [...grouped.values()].sort((a, b) => b.entries.length - a.entries.length);
}
