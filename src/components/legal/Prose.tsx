/** Shared shell for the legal pages: one column, generous measure, dated. */
export function LegalPage({
  eyebrow,
  title,
  intro,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <article className="flex flex-col gap-8">
      <header className="border-b-2 border-ink pb-4">
        <p className="eyebrow mb-1.5 text-stamp">{eyebrow}</p>
        <h1 className="text-[clamp(var(--text-2xl),5vw,var(--text-4xl))] leading-none font-bold tracking-[-0.025em]">
          {title}
        </h1>
        {intro && <p className="mt-3 max-w-[62ch] text-sm text-muted">{intro}</p>}
        <p className="mt-3 font-mono text-xs text-faint">Last updated {updated}</p>
      </header>
      <div className="flex max-w-[68ch] flex-col gap-7">{children}</div>
    </article>
  );
}

export function Clause({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-md font-semibold">{heading}</h2>
      <div className="flex flex-col gap-2 text-sm leading-relaxed text-muted">{children}</div>
    </section>
  );
}
