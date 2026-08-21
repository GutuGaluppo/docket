"use client";

import type { Route } from "next";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";

/**
 * The folder tabs across the top of the drawer.
 *
 * A client component for one reason: the tab that is forward has to know which
 * page is open, and a layout cannot read the path on the server. It is still
 * rendered on the server on the way out, so the right tab is forward in the
 * first paint and stays forward if the JavaScript never arrives — nothing here
 * waits for hydration to be legible.
 */
const TABS: ReadonlyArray<{ href: Route; label: string }> = [
  { href: "/docket", label: "Docket" },
  { href: "/board", label: "Board" },
  { href: "/calendar", label: "Calendar" },
  { href: "/archive", label: "Archive" },
  { href: "/analytics", label: "Analytics" },
  { href: "/docket/import", label: "Import" },
  { href: "/settings", label: "Settings" },
];

/**
 * A section owns its own sub-paths, so editing an entry keeps the register's
 * tab forward. Import is the exception: it lives under `/docket` in the URL but
 * is its own tab, so the register only claims the paths that are not it.
 */
export function isCurrent(pathname: string, href: string): boolean {
  const owned = pathname === href || pathname.startsWith(`${href}/`);
  if (href !== "/docket") return owned;
  return owned && !TABS.some((tab) => tab.href !== href && pathname.startsWith(tab.href));
}

/**
 * The tab answers the click, not the server.
 *
 * A navigation to a section that has to be rendered on demand takes as long as
 * it takes — the point of the boundaries inside each page — but the person who
 * clicked cannot be left wondering whether the click registered. `useLinkStatus`
 * reports the pending state of the link it is rendered inside, from the moment
 * of the click and before any request goes out, so the acknowledgement costs a
 * round trip of nothing.
 *
 * The bar is drawn along the tab's own bottom edge. With animation off — the
 * reduced-motion block in `globals.css` turns it off wholesale — it stays as a
 * full, still bar, which says the same thing without moving.
 */
function TabLabel({ label }: { label: string }) {
  const { pending } = useLinkStatus();

  return (
    <>
      {label}
      {pending && (
        <>
          <span aria-hidden="true" className="tab-progress" />
          <span className="sr-only">, loading</span>
        </>
      )}
    </>
  );
}

export function CabinetTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="Sections" className="tab-strip">
      {TABS.map((tab) => {
        const current = isCurrent(pathname, tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="tab"
            aria-current={current ? "page" : undefined}
          >
            <TabLabel label={tab.label} />
          </Link>
        );
      })}
    </nav>
  );
}
