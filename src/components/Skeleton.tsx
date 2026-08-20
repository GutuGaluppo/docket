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
