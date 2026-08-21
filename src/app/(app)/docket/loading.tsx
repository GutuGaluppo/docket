import { FiguresSkeleton, FormSkeleton, TableSkeleton } from "@/components/Skeleton";
import { SectionHeader } from "@/components/SectionHeader";

/**
 * What the register looks like the instant a tab is clicked.
 *
 * The heading is the real one — same words, same weights, from the same file
 * the page reads — so the section announces itself before the server has been
 * asked anything. Only what depends on a query is a shape.
 */
export default function Loading() {
  return (
    <>
      <SectionHeader
        section="docket"
        aside={
          <div className="flex gap-6 font-mono">
            <FiguresSkeleton label="the counters" />
          </div>
        }
      />
      <FormSkeleton />
      <div className="my-8 mb-2.5" />
      <TableSkeleton label="the register" />
    </>
  );
}
