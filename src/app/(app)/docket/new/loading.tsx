import { SectionHeader } from "@/components/SectionHeader";
import { FormSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <>
      <SectionHeader section="new" />
      <FormSkeleton />
    </>
  );
}
