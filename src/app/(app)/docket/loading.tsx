import { Bar, Placeholder } from "@/components/Skeleton";
import { SectionHeader } from "@/components/SectionHeader";

/**
 * What the desk looks like the instant a tab is clicked.
 *
 * The heading is the real one — same words, same weights, from the same file
 * the page reads — so the section announces itself before the server has been
 * asked anything. Only what depends on a query is a shape.
 */
export default function Loading() {
  return (
    <>
      <SectionHeader section="docket" />
      <div className="mt-7 flex flex-col gap-9">
        <Placeholder label="the greeting">
          <Bar className="h-24 w-full" />
        </Placeholder>
        <Placeholder
          label="the counters"
          className="grid gap-3.5 grid-cols-[repeat(auto-fit,minmax(160px,1fr))]"
        >
          <Bar className="h-21.5 w-full" />
          <Bar className="h-21.5 w-full" />
          <Bar className="h-21.5 w-full" />
          <Bar className="h-21.5 w-full" />
        </Placeholder>
        <Placeholder label="the latest entries" className="flex flex-col gap-2.5">
          <Bar className="h-14 w-full" />
          <Bar className="h-14 w-full" />
          <Bar className="h-14 w-full" />
        </Placeholder>
      </div>
    </>
  );
}
