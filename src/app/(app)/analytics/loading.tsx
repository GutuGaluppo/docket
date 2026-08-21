import { FindingsSkeleton } from "@/components/Skeleton";
import { SectionHeader } from "@/components/SectionHeader";

export default function Loading() {
  return (
    <>
      <SectionHeader section="analytics" />
      <FindingsSkeleton />
    </>
  );
}
