import { Bar, Placeholder, TableSkeleton } from "@/components/Skeleton";
import { SectionHeader } from "@/components/SectionHeader";

export default function Loading() {
  return (
    <>
      <SectionHeader section="applications" />
      <div className="mt-6 flex flex-col gap-5">
        <Placeholder label="the filters">
          <Bar className="h-9 w-64" />
        </Placeholder>
        <TableSkeleton label="the register" />
      </div>
    </>
  );
}
