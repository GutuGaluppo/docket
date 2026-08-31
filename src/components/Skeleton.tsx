/**
 * What a page shows in the places where it is still waiting on the database —
 * and only there.
 *
 * These are fallbacks for a `<Suspense>` boundary drawn around one region, never
 * a curtain over a whole screen. A heading, a form and a paragraph of prose do
 * not depend on a query: they can be on screen, and the form usable, while the
 * rows behind them are still being fetched. Covering them with a skeleton hides
 * work that was already done and makes the page feel slower than it is.
 *
 * Every shape is drawn at the size of the thing it stands in for, so nothing
 * jumps when the real content arrives. The pulse is switched off by the
 * reduced-motion block in `globals.css`.
 */

export function Bar({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`block animate-pulse rounded-[2px] bg-rule ${className}`} />
  );
}

/**
 * Wraps a fallback so a screen reader is told what is on its way. The label is
 * the region, not the page: "the register", "the board" — several can be
 * waiting at once and each says which one it is.
 */
export function Placeholder({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-busy="true" aria-label={`Loading ${label}`} className={className}>
      {children}
    </div>
  );
}

/** A counter above a heading: the number, then the word under it. */
export function FiguresSkeleton({ count = 2, label }: { count?: number; label: string }) {
  return (
    <Placeholder label={label} className="flex gap-6">
      {Array.from({ length: count }, (_, index) => (
        <span key={index} className="flex flex-col gap-2">
          <Bar className="h-6 w-9" />
          <Bar className="h-2 w-16" />
        </span>
      ))}
    </Placeholder>
  );
}

/** The rhythm of a docket table: the ruled header, then rows. */
export function TableSkeleton({ rows = 5, label }: { rows?: number; label: string }) {
  return (
    <Placeholder label={label} className="flex flex-col gap-3">
      <Bar className="h-4 w-full opacity-60" />
      {Array.from({ length: rows }, (_, index) => (
        <Bar key={index} className="h-12 w-full" />
      ))}
    </Placeholder>
  );
}

/** Five columns of empty card stock, at the width the real ones use. */
export function BoardSkeleton() {
  return (
    <Placeholder label="the board" className="bleed overflow-hidden pb-3">
      <div className="flex min-w-max items-start gap-4">
        {Array.from({ length: 5 }, (_, index) => (
          <div
            key={index}
            className="flex w-[264px] flex-none flex-col gap-3 rounded-[3px] border border-rule bg-card p-3"
          >
            <Bar className="h-3 w-24" />
            <Bar className="h-20 w-full" />
            <Bar className="h-20 w-full" />
          </div>
        ))}
      </div>
    </Placeholder>
  );
}

/** Six weeks of seven cells — the month grid's real shape. */
export function MonthSkeleton() {
  return (
    <Placeholder label="the month" className="grid grid-cols-7 gap-px">
      {Array.from({ length: 42 }, (_, index) => (
        <Bar key={index} className="h-16 w-full rounded-none opacity-70" />
      ))}
    </Placeholder>
  );
}

/** Four figures and a ruled table, at their real weights. */
export function FindingsSkeleton() {
  return (
    <Placeholder label="the findings" className="mt-6 flex flex-col gap-10">
      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="flex flex-col gap-2 border-t border-rule pt-3">
            <Bar className="h-7 w-16" />
            <Bar className="h-2 w-24" />
          </div>
        ))}
      </section>
      <section className="flex flex-col gap-3">
        <Bar className="h-2 w-28" />
        {Array.from({ length: 5 }, (_, index) => (
          <Bar key={index} className="h-6 w-full" />
        ))}
      </section>
    </Placeholder>
  );
}

/**
 * The tailoring workspace: the figure, the advert, the document and the panel.
 *
 * Drawn in the proportions the real screen uses, so the arrival of the CV does
 * not move the page under someone who has already started reading it.
 */
export function CvSkeleton() {
  return (
    <Placeholder label="your CV" className="mt-6 flex flex-col gap-5">
      <Bar className="h-14 w-full rounded-xl" />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex justify-center">
          <div className="flex w-full max-w-[794px] flex-col gap-4 rounded border border-rule bg-sheet p-10 shadow-elevation-3">
            <Bar className="h-8 w-64" />
            <Bar className="h-3 w-44" />
            {Array.from({ length: 8 }, (_, index) => (
              <Bar key={index} className="h-9 w-full" />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <Bar className="h-32 w-full rounded-xl" />
          {Array.from({ length: 4 }, (_, index) => (
            <Bar key={index} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </Placeholder>
  );
}

/** A card of form fields: the stamp form, before it is interactive. */
export function FormSkeleton() {
  return (
    <Placeholder
      label="the entry form"
      className="mt-6 flex flex-col gap-5 rounded-[3px] border border-rule bg-card p-6 shadow-paper"
    >
      <Bar className="h-2.5 w-24" />
      <div className="flex flex-col gap-2">
        <Bar className="h-3 w-20" />
        <Bar className="h-9 w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="flex flex-col gap-2">
            <Bar className="h-3 w-20" />
            <Bar className="h-8 w-full" />
          </div>
        ))}
      </div>
      <Bar className="h-24 w-full" />
      <Bar className="h-10 w-44" />
    </Placeholder>
  );
}

/** The correction sheet: the number, the company, the stamp, and the form. */
export function EntrySheetSkeleton() {
  return (
    <Placeholder label="the entry" className="mt-4 flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="flex flex-col gap-2">
          <Bar className="h-2.5 w-16" />
          <Bar className="h-8 w-56" />
          <Bar className="h-3 w-40" />
        </div>
        <Bar className="h-12 w-28" />
      </div>
      <Bar className="h-64 w-full" />
    </Placeholder>
  );
}
