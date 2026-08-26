import { SectionHeader } from "@/components/SectionHeader";
import { CvSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <>
      <SectionHeader section="cv" />
      <CvSkeleton />
    </>
  );
}
