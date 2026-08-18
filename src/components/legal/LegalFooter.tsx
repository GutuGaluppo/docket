import Link from "next/link";

import { ContactModal } from "@/components/legal/ContactModal";
import { IMPRESSUM_READY, OPERATOR } from "@/lib/legal";

/**
 * §5 DDG wants the provider identification reachable from every page, so this
 * sits in both shells — the public one and the signed-in one. The Impressum
 * link appears only once the address exists; linking to a 404 would be worse
 * than not linking at all.
 */
export function LegalFooter({
  compact = false,
  contactEmail = "",
}: {
  compact?: boolean;
  contactEmail?: string;
}) {
  return (
    <footer
      className={`flex flex-col gap-3 border-t border-rule pt-5 ${compact ? "mt-12" : "mt-16"}`}
    >
      <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11px] tracking-[0.1em] text-muted uppercase">
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        {IMPRESSUM_READY && <Link href="/impressum">Impressum</Link>}
        <ContactModal initialEmail={contactEmail} />
      </nav>
      <p className="font-mono text-[11px] text-muted">
        Docket — operated by {OPERATOR.name}, {OPERATOR.city}, {OPERATOR.country}.
      </p>
    </footer>
  );
}
