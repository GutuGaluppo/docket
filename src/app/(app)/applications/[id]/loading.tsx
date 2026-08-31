import { Bar, Placeholder } from "@/components/Skeleton";

export default function Loading() {
  return (
    <>
      <span className="eyebrow text-muted">← All applications</span>
      <Placeholder label="the entry" className="mt-6 flex flex-col gap-5">
        <Bar className="h-16 w-80" />
        <Bar className="h-64 w-full" />
      </Placeholder>
    </>
  );
}
