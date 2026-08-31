"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * How the bar above the page learns what the page is called.
 *
 * Scrolling past a heading should not leave the reader without one, so the
 * topbar picks the title up as it leaves the screen. The topbar is drawn by the
 * shell and the title is written by the page, and those are two different
 * subtrees — this is the wire between them.
 *
 * A context rather than a DOM read: the heading is server-rendered inside a
 * Suspense boundary that may resolve after the shell has mounted, and a
 * `querySelector` run once on navigation would miss it. A component that
 * registers itself cannot miss it, because it registers when it renders.
 */
type Registry = { title: string; setTitle: (title: string) => void };

const Context = createContext<Registry | null>(null);

export function PageTitleProvider({
  fallback,
  children,
}: {
  /** What the bar says until a page claims the slot — the section's own name. */
  fallback: string;
  children: ReactNode;
}) {
  const [title, setTitle] = useState("");

  return (
    <Context.Provider value={{ title: title || fallback, setTitle }}>{children}</Context.Provider>
  );
}

export function usePageTitle(): string {
  return useContext(Context)?.title ?? "";
}

/**
 * Rendered by a page's heading. It draws nothing: its whole job is to say what
 * the heading above it reads, and to hand the slot back on the way out so a
 * section without its own title falls back to the section name rather than to
 * the last page's.
 */
export function PageTitleBeacon({ title }: { title: string }) {
  const registry = useContext(Context);

  useEffect(() => {
    if (!registry) return;
    registry.setTitle(title);
    return () => registry.setTitle("");
    // The setter is stable; re-running on the object identity would clear the
    // slot on every render of the provider.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title]);

  return null;
}
