import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";

import { RejectionsTable } from "@/components/archive/RejectionsTable";
import { FiguresSkeleton, TableSkeleton } from "@/components/Skeleton";
import { doorRate } from "@/lib/rejection";
import { archiveQuerySchema } from "@/lib/validation/rejection";
import { requireScope } from "@/server/auth/session";
import {
  getRejectionCounts,
  listRejections,
  type Rejection,
  type RejectionCounts,
} from "@/server/db/queries/rejections";

export const metadata: Metadata = { title: "Archive" };

async function Figures({ counts }: { counts: Promise<RejectionCounts> }) {
  const filed = await counts;

  return (
    <>
      <div>
        <b className="block text-2xl leading-none font-bold">
          {String(filed.total).padStart(2, "0")}
        </b>
        <span className="text-[10px] tracking-[0.14em] text-muted uppercase">Filed</span>
      </div>
      <div>
        <b className="block text-2xl leading-none font-bold">
          {String(filed.beforeAnyInterview).padStart(2, "0")}
        </b>
        <span className="text-[10px] tracking-[0.14em] text-muted uppercase">
          Before any interview
        </span>
      </div>
      <div>
        <b className="block text-2xl leading-none font-bold">
          {String(filed.thisMonth).padStart(2, "0")}
        </b>
        <span className="text-[10px] tracking-[0.14em] text-muted uppercase">This month</span>
      </div>
    </>
  );
}

/**
 * The reading of those numbers. It has no fallback shape on purpose: on an
 * empty archive there is nothing to say and the line never appears, so a
 * skeleton here would promise a sentence that may not exist.
 */
async function DoorRate({ counts }: { counts: Promise<RejectionCounts> }) {
  const filed = await counts;
  const atTheDoor = doorRate(filed.total, filed.beforeAnyInterview);
  if (atTheDoor === null) return null;

  return (
    <p className="mt-5 max-w-[60ch] border-l-2 border-rule pl-4 text-sm text-muted">
      <b className="font-mono text-ink">{atTheDoor}%</b> of the refusals came before a single
      interview was booked
      {atTheDoor >= 50
        ? " — that is a screening problem, not a volume problem."
        : " — most of these got as far as a conversation."}
    </p>
  );
}

async function Filed({
  rejections,
  counts,
}: {
  rejections: Promise<Rejection[]>;
  counts: Promise<RejectionCounts>;
}) {
  const [rows, filed] = await Promise.all([rejections, counts]);

  if (rows.length > 0) return <RejectionsTable rejections={rows} />;

  return (
    <div className="rounded-[3px] border border-dashed border-rule bg-card px-6 py-12 text-center">
      <p className="eyebrow mb-2.5 text-stamp">Empty archive</p>
      <p className="text-base text-muted">
        {filed.total === 0 ? (
          <>
            Nothing has been refused yet. When it happens, file it from the{" "}
            <Link href="/docket" className="border-b border-stamp text-ink">
              register
            </Link>{" "}
            or drop the card in the last column of the board, and it will be kept here.
          </>
        ) : (
          "No filed application matches that search."
        )}
      </p>
    </div>
  );
}

/**
 * Where the refusals are kept.
 *
 * The register is what is still in play, so a company that has said no leaves
 * it — but it does not leave the docket. The entry keeps its number, its stamp
 * and its history here, and one click puts it back if the answer changes.
 *
 * The figure worth reading is not the total. It is how many of them never
 * reached an interview: applications dying at the door and applications dying
 * after someone has met you are two different problems, and only one of them is
 * fixed by sending more.
 */
export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const query = archiveQuerySchema.parse({ q: typeof raw.q === "string" ? raw.q : undefined });

  const counts = requireScope().then(getRejectionCounts);
  const rejections = requireScope().then((scope) => listRejections(scope, { search: query.q }));

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink pb-4">
        <div>
          <p className="eyebrow mb-1.5 text-stamp">Closed without an offer</p>
          <h1 className="text-[clamp(var(--text-2xl),5vw,var(--text-5xl))] leading-none font-bold tracking-[-0.025em]">
            Archive
          </h1>
          <p className="mt-2 max-w-[52ch] text-sm text-muted">
            Applications that ended in a refusal. Nothing here is deleted — each one keeps its
            number, its stamp and its history, and reopens in one click if the answer changes.
          </p>
        </div>
        <div className="flex gap-6 font-mono">
          <Suspense fallback={<FiguresSkeleton count={3} label="the counters" />}>
            <Figures counts={counts} />
          </Suspense>
        </div>
      </header>

      <Suspense fallback={null}>
        <DoorRate counts={counts} />
      </Suspense>

      <div className="my-8 mb-2.5 flex flex-wrap items-center justify-between gap-3">
        <form
          method="get"
          action="/archive"
          className="flex items-center gap-2"
          suppressHydrationWarning
        >
          <input
            type="search"
            name="q"
            defaultValue={query.q}
            className="min-w-[240px] rounded-[2px] border border-rule bg-sheet px-3 py-2 font-mono text-[13px] focus:border-stamp focus:outline-none"
            placeholder="Search company, position, stack or city"
            aria-label="Search the archive"
            suppressHydrationWarning
          />
          <button type="submit" className="link-quiet" suppressHydrationWarning>
            Search
          </button>
        </form>
        <Link href="/docket" className="link-quiet">
          Back to the register
        </Link>
      </div>

      <Suspense fallback={<TableSkeleton rows={4} label="the archive" />}>
        <Filed rejections={rejections} counts={counts} />
      </Suspense>
    </>
  );
}
