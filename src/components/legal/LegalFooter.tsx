import Link from "next/link";

import { IMPRESSUM_READY, OPERATOR } from "@/lib/legal";

/**
 * §5 DDG wants the provider identification reachable from every page, so this
 * sits in both shells — the public one and the signed-in one. The Impressum
 * link appears only once the address exists; linking to a 404 would be worse
 * than not linking at all.
 */
export function LegalFooter({ compact = false }: { compact?: boolean }) {
  return (
    <footer
      className={`flex flex-col gap-3 border-t border-rule pt-5 ${compact ? "mt-12" : "mt-16"}`}
    >
      <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11px] tracking-[0.1em] text-muted uppercase">
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        {IMPRESSUM_READY && <Link href="/impressum">Impressum</Link>}
        <a href={`mailto:${OPERATOR.email}`}>Contact</a>
      </nav>
      <p className="font-mono text-[11px] text-faint">
        Docket — operated by {OPERATOR.name}, {OPERATOR.city}, {OPERATOR.country}.
      </p>
    </footer>
  );
}
