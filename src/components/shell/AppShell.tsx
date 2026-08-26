"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { Route } from "next";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "@/components/ThemeToggle";
import { SectionIcon, type IconName } from "./SectionIcon";

/**
 * The shell every signed-in page is served inside.
 *
 * A sidebar rather than a row of tabs, for the reason every tool that grew past
 * four screens ended up with one: the list is vertical, so it can hold groups
 * and keep growing without the sections either shrinking or scrolling out of
 * sight, and the section you are in stays legible at a glance instead of being
 * the one tab that looks slightly different.
 *
 * It is a client component because three things depend on the browser: which
 * item is current, whether the rail is collapsed, and whether the drawer is open
 * on a phone. The page inside it is passed as `children` and stays exactly as
 * server-rendered — nothing here makes the content client-side.
 */
type Item = { href: Route; label: string; icon: IconName };

const GROUPS: ReadonlyArray<{ label: string; items: readonly Item[] }> = [
  {
    label: "Register",
    items: [
      { href: "/docket", label: "Docket", icon: "docket" },
      { href: "/board", label: "Board", icon: "board" },
      { href: "/calendar", label: "Calendar", icon: "calendar" },
      { href: "/archive", label: "Archive", icon: "archive" },
    ],
  },
  { label: "Preparation", items: [{ href: "/cv", label: "CV", icon: "cv" }] },
  { label: "Findings", items: [{ href: "/analytics", label: "Analytics", icon: "analytics" }] },
  { label: "Records", items: [{ href: "/docket/import", label: "Import", icon: "import" }] },
];

const SETTINGS: Item = { href: "/settings", label: "Settings", icon: "settings" };

const ITEMS: readonly Item[] = [...GROUPS.flatMap((group) => group.items), SETTINGS];

/**
 * A section owns its own sub-paths, so correcting an entry keeps the register
 * marked. Import is the exception: it lives under `/docket` in the URL but is
 * its own section, so the register only claims the paths that are not it.
 */
export function isCurrent(pathname: string, href: string): boolean {
  const owned = pathname === href || pathname.startsWith(`${href}/`);
  if (href !== "/docket") return owned;
  return owned && !ITEMS.some((item) => item.href !== href && pathname.startsWith(item.href));
}

/** The click, acknowledged before any request leaves the browser. */
function NavLabel({ label }: { label: string }) {
  const { pending } = useLinkStatus();

  return (
    <>
      <span className="nav-label">{label}</span>
      {pending && (
        <>
          <span aria-hidden="true" className="nav-pending" />
          <span className="sr-only">, loading</span>
        </>
      )}
    </>
  );
}

function NavItem({ item, current }: { item: Item; current: boolean }) {
  return (
    <Link
      href={item.href}
      className="nav-item"
      aria-current={current ? "page" : undefined}
      title={item.label}
    >
      <SectionIcon name={item.icon} />
      <NavLabel label={item.label} />
    </Link>
  );
}

const RAIL_KEY = "docket:rail";

export function AppShell({
  email,
  signOut,
  footer,
  children,
}: {
  email: string;
  /** The sign-out form. A server action, rendered on the server and passed in. */
  signOut: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [rail, setRail] = useState(false);
  const [open, setOpen] = useState(false);

  // Read on the client only: the server has no way to know, and rendering the
  // wide sidebar first means the collapsed state never flashes as a layout jump
  // on the pages that matter most — it settles before paint on a warm load.
  useEffect(() => {
    setRail(window.localStorage.getItem(RAIL_KEY) === "1");
  }, []);

  // A drawer that survives the navigation it started is a drawer in the way.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function toggleRail() {
    setRail((value) => {
      window.localStorage.setItem(RAIL_KEY, value ? "0" : "1");
      return !value;
    });
  }

  const current = ITEMS.find((item) => isCurrent(pathname, item.href));

  return (
    <div className="shell" data-rail={rail ? "true" : undefined}>
      <aside className="sidebar" data-open={open ? "true" : undefined} aria-label="Sections">
        <div className="sidebar-head">
          <Link href="/docket" className="wordmark">
            <span aria-hidden="true" className="wordmark-mark">
              №
            </span>
            <span className="nav-label">Docket</span>
          </Link>
          <button
            type="button"
            onClick={toggleRail}
            className="icon-button rail-only-hide"
            aria-label={rail ? "Expand the sidebar" : "Collapse the sidebar"}
            suppressHydrationWarning
          >
            <SectionIcon name="rail" />
          </button>
        </div>

        <Link href="/docket" className="new-entry">
          <SectionIcon name="plus" />
          <span className="nav-label">New entry</span>
        </Link>

        <nav className="sidebar-nav">
          {GROUPS.map((group) => (
            <div key={group.label} className="nav-group">
              <p className="nav-group-label">{group.label}</p>
              {group.items.map((item) => (
                <NavItem key={item.href} item={item} current={isCurrent(pathname, item.href)} />
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-foot">
          <NavItem item={SETTINGS} current={isCurrent(pathname, SETTINGS.href)} />
          <p className="sidebar-identity nav-label" title={email}>
            {email}
          </p>
          <div className="sidebar-controls nav-label">
            <ThemeToggle />
            {signOut}
          </div>
        </div>
      </aside>

      {open && (
        <button
          type="button"
          className="scrim"
          aria-label="Close the menu"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="main">
        <header className="topbar">
          <button
            type="button"
            className="icon-button drawer-only"
            aria-label="Open the menu"
            onClick={() => setOpen(true)}
            suppressHydrationWarning
          >
            <SectionIcon name="menu" />
          </button>
          <span className="topbar-title">{current?.label ?? "Docket"}</span>
        </header>

        <main className="content">{children}</main>
        <div className="content-footer">{footer}</div>
      </div>
    </div>
  );
}
