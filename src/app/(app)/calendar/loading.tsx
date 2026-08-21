import { Bar, MonthSkeleton, Placeholder } from "@/components/Skeleton";
import { SectionHeader } from "@/components/SectionHeader";

export default function Loading() {
  return (
    <>
      <SectionHeader
        section="calendar"
        aside={
          <Placeholder label="the month" className="flex items-center gap-4">
            <Bar className="h-3 w-12" />
            <Bar className="h-3 w-28" />
            <Bar className="h-3 w-12" />
          </Placeholder>
        }
      />
      <div className="mt-6 flex flex-col gap-6">
        <Placeholder label="the schedule form" className="flex flex-col gap-3">
          <Bar className="h-3 w-32" />
          <Bar className="h-10 w-full" />
        </Placeholder>
        <MonthSkeleton />
      </div>
    </>
  );
}
