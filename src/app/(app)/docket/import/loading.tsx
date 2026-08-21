import { Bar, Placeholder } from "@/components/Skeleton";
import { SectionHeader } from "@/components/SectionHeader";

/**
 * Import reads nothing from the database, so this is not a wait for data — it
 * is the boundary that keeps the register's skeleton from standing in for this
 * page. `loading.tsx` covers every segment under it, and `/docket/import` is
 * one of those; without this file, clicking Import would flash the register.
 */
export default function Loading() {
  return (
    <>
      <SectionHeader section="import" />
      <Placeholder
        label="the import form"
        className="mt-6 flex flex-col gap-4 rounded-[3px] border border-rule bg-card p-6 shadow-paper"
      >
        <Bar className="h-3 w-28" />
        <Bar className="h-10 w-full" />
        <Bar className="h-9 w-40" />
      </Placeholder>
    </>
  );
}
