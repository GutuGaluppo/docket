import { EntrySheetSkeleton } from "@/components/Skeleton";

/**
 * Correcting an entry is a segment under `/docket`, so without this file the
 * register's own boundary would stand in for it — the wrong heading over the
 * wrong shape.
 */
export default function Loading() {
  return (
    <main className="mx-auto max-w-[900px] px-5 py-10">
      <span className="eyebrow text-muted">← Back to the docket</span>
      <EntrySheetSkeleton />
    </main>
  );
}
