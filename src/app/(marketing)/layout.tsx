import Link from "next/link";

/**
 * The public shell. Server-rendered, no client JavaScript of its own — the
 * hero detector and the scroll reveal are the only interactive things on the
 * page, and both are opt-in islands.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen px-5 pt-8 pb-16">
      <div className="mx-auto max-w-[1080px]">
        <nav className="mb-10 flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="text-xl font-bold tracking-[-0.02em] no-underline">
            Docket
          </Link>
          <Link
            href="/sign-in"
            className="font-mono text-[11px] tracking-[0.1em] text-muted uppercase"
          >
            Sign in
          </Link>
        </nav>

        <main>{children}</main>

        <footer className="mt-16 flex flex-col gap-4 border-t-2 border-ink pt-6">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[11px] tracking-[0.1em] text-muted uppercase">
            <span className="text-ink">Docket</span>
            <Link href="/sign-in">Sign in</Link>
            {/*
              Privacy and terms are written once the operating entity is
              decided — a policy that names the wrong controller is worse than
              an absent one. Until then there is no link rather than a link to
              a placeholder.
            */}
          </div>
          <p className="max-w-[62ch] font-mono text-xs text-faint">
            A numbered register of the jobs you applied for. Your entries are yours: export them as
            CSV or JSON at any time, and delete the account in one click.
          </p>
        </footer>
      </div>
    </div>
  );
}
