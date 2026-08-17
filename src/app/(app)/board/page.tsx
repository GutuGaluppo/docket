import type { Metadata } from "next";
import Link from "next/link";

import { Board } from "@/components/board/Board";
import { requireScope } from "@/server/auth/session";
import { getBoard } from "@/server/db/queries/board";

export const metadata: Metadata = { title: "Board" };

export default async function BoardPage() {
  const scope = await requireScope();
  const columns = await getBoard(scope);
  const total = columns.reduce((sum, column) => sum + column.cards.length, 0);

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink pb-4">
        <div>
          <p className="eyebrow mb-1.5 text-stamp">Proceedings</p>
          <h1 className="text-[clamp(var(--text-2xl),5vw,var(--text-5xl))] leading-none font-bold tracking-[-0.025em]">
            Board
          </h1>
          <p className="mt-2 max-w-[52ch] text-sm text-muted">
            Every entry starts in the first column and moves right as the process advances. Drag a
            card, or use the selector on it — both do the same thing, and every move is written to
            the entry&rsquo;s history.
          </p>
        </div>
        <div className="font-mono">
          <b className="block text-2xl leading-none font-bold">
            {String(total).padStart(2, "0")}
          </b>
          <span className="text-[10px] tracking-[0.14em] text-muted uppercase">On the board</span>
        </div>
      </header>

      <div className="mt-6">
        {total === 0 ? (
          <div className="rounded-[3px] border border-dashed border-rule bg-card px-6 py-12 text-center">
            <p className="eyebrow mb-2.5 text-stamp">Nothing in proceedings</p>
            <p className="text-base text-muted">
              Your docket is empty, so the board is too.{" "}
              <Link href="/docket" className="border-b border-stamp text-ink">
                Stamp an application
              </Link>{" "}
              and it will appear in the first column.
            </p>
          </div>
        ) : (
          <Board columns={columns} />
        )}
      </div>
    </>
  );
}
