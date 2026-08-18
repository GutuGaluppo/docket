import Link from "next/link";

import { ThemeToggle } from "@/components/ThemeToggle";
import { LegalFooter } from "@/components/legal/LegalFooter";

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
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Link
              href="/sign-in"
              className="font-mono text-[11px] tracking-[0.1em] text-muted uppercase"
            >
              Sign in
            </Link>
          </div>
        </nav>

        <main>{children}</main>

        <LegalFooter />
      </div>
    </div>
  );
}
