import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";

import { SectionHeader } from "@/components/SectionHeader";
import { Board } from "@/components/board/Board";
import { Bar, BoardSkeleton, Placeholder } from "@/components/Skeleton";
import { requireScope } from "@/server/auth/session";
import { getBoard, type BoardColumn } from "@/server/db/queries/board";
import { getRejectionCounts, type RejectionCounts } from "@/server/db/queries/rejections";

export const metadata: Metadata = { title: "Board" };

async function OnTheBoard({ board }: { board: Promise<BoardColumn[]> }) {
  const columns = await board;
  const total = columns.reduce((sum, column) => sum + column.cards.length, 0);

  return (
    <>
      <b className="block text-2xl leading-none font-bold">{String(total).padStart(2, "0")}</b>
      <span className="text-[10px] tracking-[0.14em] text-muted uppercase">On the board</span>
    </>
  );
}

async function Proceedings({
  board,
  filed,
}: {
  board: Promise<BoardColumn[]>;
  filed: Promise<RejectionCounts>;
}) {
  const [columns, archive] = await Promise.all([board, filed]);
  const total = columns.reduce((sum, column) => sum + column.cards.length, 0);

  if (total === 0) {
    return (
      <div className="rounded-[3px] border border-dashed border-rule bg-card px-6 py-12 text-center">
        <p className="eyebrow mb-2.5 text-stamp">Nothing in proceedings</p>
        <p className="text-base text-muted">
          {archive.total > 0 ? (
            <>
              Nothing is in proceedings. Everything stamped so far is{" "}
              <Link href="/archive" className="border-b border-stamp text-ink">
                in the archive
              </Link>
              .
            </>
          ) : (
            <>
              Your docket is empty, so the board is too.{" "}
              <Link href="/docket/new" className="border-b border-stamp text-ink">
                Stamp an application
              </Link>{" "}
              and it will appear in the first column.
            </>
          )}
        </p>
      </div>
    );
  }

  return <Board columns={columns} filed={archive.total} />;
}

export default function BoardPage() {
  const board = requireScope().then(getBoard);
  const filed = requireScope().then(getRejectionCounts);

  return (
    <>
      <SectionHeader
        section="board"
        aside={
          <div className="font-mono">
            <Suspense
              fallback={
                <Placeholder label="the count" className="flex flex-col gap-2">
                  <Bar className="h-6 w-9" />
                  <Bar className="h-2 w-20" />
                </Placeholder>
              }
            >
              <OnTheBoard board={board} />
            </Suspense>
          </div>
        }
      />

      <div className="mt-6">
        <Suspense fallback={<BoardSkeleton />}>
          <Proceedings board={board} filed={filed} />
        </Suspense>
      </div>
    </>
  );
}
