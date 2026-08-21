import { Bar, BoardSkeleton, Placeholder } from "@/components/Skeleton";
import { SectionHeader } from "@/components/SectionHeader";

export default function Loading() {
  return (
    <>
      <SectionHeader
        section="board"
        aside={
          <div className="font-mono">
            <Placeholder label="the count" className="flex flex-col gap-2">
              <Bar className="h-6 w-9" />
              <Bar className="h-2 w-20" />
            </Placeholder>
          </div>
        }
      />
      <div className="mt-6">
        <BoardSkeleton />
      </div>
    </>
  );
}
