import { FiguresSkeleton, TableSkeleton } from "@/components/Skeleton";
import { SectionHeader } from "@/components/SectionHeader";

export default function Loading() {
  return (
    <>
      <SectionHeader
        section="archive"
        aside={
          <div className="flex gap-6 font-mono">
            <FiguresSkeleton count={3} label="the counters" />
          </div>
        }
      />
      <div className="my-8 mb-2.5" />
      <TableSkeleton rows={4} label="the archive" />
    </>
  );
}
