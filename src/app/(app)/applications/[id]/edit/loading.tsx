import { EntrySheetSkeleton } from "@/components/Skeleton";

/**
 * Correcting an entry is a segment under `/applications`, so without this file
 * the register's own boundary would stand in for it — the wrong heading over
 * the wrong shape.
 */
export default function Loading() {
  return (
    <>
      <span className="eyebrow text-muted">← Back to the entry</span>
      <EntrySheetSkeleton />
    </>
  );
}
