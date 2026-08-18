import Link from "next/link";

import { ContactModal } from "@/components/legal/ContactModal";
import { IMPRESSUM_READY, OPERATOR } from "@/lib/legal";
import { APP_VERSION, BUILD_REF } from "@/lib/version";

/**
 * §5 DDG wants the provider identification reachable from every page, so this
 * sits in both shells — the public one and the signed-in one. The Impressum
 * link appears only once the address exists; linking to a 404 would be worse
 * than not linking at all.
 */
export function LegalFooter({
  compact = false,
  contactName = "",
  contactEmail = "",
}: {
  compact?: boolean;
  contactName?: string;
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
        <ContactModal initialName={contactName} initialEmail={contactEmail} />
      </nav>
      <p className="font-mono text-[11px] text-muted">
        Docket{" "}
        {/*
          The build reference rides along as a title rather than as text. On the
          page it would be noise for everyone; on hover it answers the one
          question the version cannot — whether the deployment in front of you is
          the one you just shipped.
        */}
        <span title={BUILD_REF ? `build ${BUILD_REF}` : undefined}>v{APP_VERSION}</span> — operated
        by {OPERATOR.name}, {OPERATOR.city}, {OPERATOR.country}.
      </p>
    </footer>
  );
}
