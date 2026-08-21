import { Bar, Placeholder } from "@/components/Skeleton";
import { SectionHeader } from "@/components/SectionHeader";

export default function Loading() {
  return (
    <>
      <SectionHeader section="settings" />
      {Array.from({ length: 2 }, (_, index) => (
        <Placeholder
          key={index}
          label="the account"
          className="mt-6 flex flex-col gap-3 rounded-[3px] border border-rule bg-card p-6 shadow-paper"
        >
          <Bar className="h-2.5 w-24" />
          <Bar className="h-3 w-full max-w-[52ch]" />
          <Bar className="h-9 w-64" />
        </Placeholder>
      ))}
    </>
  );
}
