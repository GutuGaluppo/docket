"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { Route } from "next";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "@/components/ThemeToggle";
import { openCommandPalette } from "@/components/command/palette-channel";
import { CV_ANALYSIS_ENABLED } from "@/lib/features";
import { PageTitleProvider, usePageTitle } from "./PageTitle";
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
 * It is a client component because four things depend on the browser: which
 * item is current, whether the rail is collapsed, whether the drawer is open on
 * a phone, and how far down the page has been scrolled. The page inside it is
 * passed as `children` and stays exactly as server-rendered — nothing here
 * makes the content client-side.
 */
type Item = { href: Route; label: string; icon: IconName };

/**
 * Two sections that used to be one. The docket is the desk — what to do next,
 * and what has happened so far. The list of companies applied to is a register,
 * long and searchable, and it was never going to sit comfortably under the same
 * heading as a form for adding to it.
 */
const GROUPS: ReadonlyArray<{ label: string; items: readonly Item[] }> = [
  {
    label: "Register",
    items: [
      { href: "/docket", label: "Docket", icon: "docket" },
      { href: "/applications", label: "Applications", icon: "applications" },
      { href: "/board", label: "Board", icon: "board" },
      { href: "/calendar", label: "Calendar", icon: "calendar" },
      { href: "/archive", label: "Archive", icon: "archive" },
    ],
  },
  ...(CV_ANALYSIS_ENABLED
    ? [{ label: "Preparation", items: [{ href: "/cv" as Route, label: "CV", icon: "cv" as IconName }] }]
    : []),
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

/**
 * How far the page has to travel before the heading is considered gone.
 *
 * Measured against the heading's own height rather than a fixed number of
 * pixels would be more exact, but it would also mean reading layout on every
 * scroll event. A threshold just past the top of a heading is close enough that
 * the swap always lands while the title is on its way out, and it costs
 * nothing.
 */
const SCROLL_THRESHOLD = 96;

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
  const [scrolled, setScrolled] = useState(false);

  // Read on the client only: the server has no way to know, and rendering the
  // wide sidebar first means the collapsed state never flashes as a layout jump
  // on the pages that matter most — it settles before paint on a warm load.
  useEffect(() => {
    setRail(window.localStorage.getItem(RAIL_KEY) === "1");
  }, []);

  // A drawer that survives the navigation it started is a drawer in the way.
  useEffect(() => setOpen(false), [pathname]);

  /**
   * The scroll state the heading transition hangs off.
   *
   * A threshold with hysteresis, not a raw offset: a page parked within a pixel
   * of the boundary would otherwise flicker between the two titles on every
   * wheel tick. The listener is passive and writes state only when the answer
   * actually changes, so scrolling stays off React's critical path.
   */
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled((was) => (was ? y > SCROLL_THRESHOLD - 32 : y > SCROLL_THRESHOLD));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pathname]);

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
    <PageTitleProvider fallback={current?.label ?? "Docket"}>
      <div
        className="shell"
        data-rail={rail ? "true" : undefined}
        data-scrolled={scrolled || undefined}
      >
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

          <Link href="/docket/new" className="new-entry">
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
            <div className="sidebar-controls nav-label">{signOut}</div>
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

            <TopbarTitles section={current?.label ?? "Docket"} />

            <div className="topbar-tools">
              <button
                type="button"
                className="topbar-search"
                onClick={openCommandPalette}
                aria-label="Search and commands"
                suppressHydrationWarning
              >
                <SearchGlyph />
                <span className="topbar-search-label">Search or jump to…</span>
                <span className="kbd">⌘K</span>
              </button>

              {/* In the bar rather than at the bottom of the sidebar. Choosing a
                  theme is something people do while looking at the page they
                  want to change, and the sidebar's foot is the one place on the
                  screen nobody looks while reading. */}
              <ThemeToggle />
            </div>
          </header>

          {/* Keyed by path so the entrance plays on every navigation: the page
              that arrives is a different page, and saying so in motion is
              cheaper to read than noticing the words changed. */}
          <main
            key={pathname}
            className={`content page-enter${pathname.startsWith("/board") ? " content-wide" : ""}`}
          >
            {children}
          </main>
          <div className="content-footer">{footer}</div>
        </div>
      </div>
    </PageTitleProvider>
  );
}

/**
 * The two labels the bar can be showing, in the same cell.
 *
 * Both are always in the document and both are always readable by a screen
 * reader — what changes is which one is opaque. Swapping the text itself would
 * make the bar announce a new heading on every scroll, which is noise.
 */
function TopbarTitles({ section }: { section: string }) {
  const title = usePageTitle();

  return (
    <div className="topbar-titles">
      <span className="topbar-title topbar-section">{section}</span>
      <span className="topbar-page-title" aria-hidden="true">
        {title}
      </span>
    </div>
  );
}

function SearchGlyph() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      className="h-4 w-4 shrink-0"
    >
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5 14 14" />
    </svg>
  );
}
