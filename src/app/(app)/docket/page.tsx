import type { Metadata } from "next";
import Link from "next/link";

import { EntriesTable } from "@/components/docket/EntriesTable";
import { StampForm } from "@/components/docket/StampForm";
import { listQuerySchema } from "@/lib/validation/entry";
import { getEntryCounts, listEntries } from "@/server/db/queries/applications";
import { requireScope } from "@/server/auth/session";

export const metadata: Metadata = { title: "Your docket" };

export default async function DocketPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const scope = await requireScope();
  const raw = await searchParams;
  const query = listQuerySchema.parse({
    q: typeof raw.q === "string" ? raw.q : undefined,
    sort: typeof raw.sort === "string" ? raw.sort : undefined,
    dir: typeof raw.dir === "string" ? raw.dir : undefined,
  });

  const [entries, counts] = await Promise.all([
    listEntries(scope, { search: query.q, sort: query.sort, direction: query.dir }),
    getEntryCounts(scope),
  ]);

  const exportHref = query.q ? `/docket/export?q=${encodeURIComponent(query.q)}` : "/docket/export";

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink pb-4">
        <div>
          <p className="eyebrow mb-1.5 text-stamp">Personal register · kept by you</p>
          <h1 className="text-[clamp(28px,5vw,42px)] leading-none font-bold tracking-[-0.02em]">
            Your docket
          </h1>
          <p className="mt-2 max-w-[46ch] text-sm text-muted">
            Every application gets a number and a stamp with the local date and time it was sent.
          </p>
        </div>
        <div className="flex gap-6 font-mono">
          <div>
            <b className="block text-[26px] leading-none font-bold">
              {String(counts.total).padStart(2, "0")}
            </b>
            <span className="text-[10px] tracking-[0.14em] text-muted uppercase">In total</span>
          </div>
          <div>
            <b className="block text-[26px] leading-none font-bold">
              {String(counts.thisMonth).padStart(2, "0")}
            </b>
            <span className="text-[10px] tracking-[0.14em] text-muted uppercase">This month</span>
          </div>
        </div>
      </header>

      <StampForm />

      <div className="my-8 mb-2.5 flex flex-wrap items-center justify-between gap-3">
        <form method="get" action="/docket" className="flex items-center gap-2">
          <input
            type="search"
            name="q"
            defaultValue={query.q}
            className="min-w-[240px] rounded-[2px] border border-rule bg-transparent px-3 py-2 font-mono text-[13px] focus:border-stamp focus:outline-none"
            placeholder="Search company, position, stack or city"
            aria-label="Search your docket"
          />
          <input type="hidden" name="sort" value={query.sort} />
          <input type="hidden" name="dir" value={query.dir} />
          <button type="submit" className="link-quiet">
            Search
          </button>
        </form>
        {counts.total > 0 && (
          <a className="link-quiet" href={exportHref} download>
            Download CSV
          </a>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="rounded-[3px] border border-dashed border-rule bg-card px-6 py-12 text-center">
          <p className="eyebrow mb-2.5 text-stamp">Blank register</p>
          <p className="text-[15px] text-muted">
            {counts.total === 0 ? (
              <>
                Your docket is empty. Stamp your first application above, or{" "}
                <Link href="/docket/import" className="border-b border-stamp text-ink">
                  import what you already have
                </Link>
                .
              </>
            ) : (
              "No entry matches that search."
            )}
          </p>
        </div>
      ) : (
        <EntriesTable
          entries={entries}
          search={query.q}
          sort={{ field: query.sort, direction: query.dir }}
        />
      )}
    </>
  );
}
