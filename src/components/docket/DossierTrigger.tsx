"use client";

import { useDossier } from "./EntryDossier";

/**
 * What makes an entry openable, wherever it is listed.
 *
 * A button rather than a link: the dossier is a panel over the listing, and the
 * listing is what the reader came for — closing it should put them back exactly
 * where they were, which a navigation does not do. The whole label stays inside
 * the button so the hit area is the name itself, and screen readers announce
 * which entry is about to open.
 *
 * Outside a `DossierProvider` there is no panel to open, so the label renders as
 * plain text and nothing pretends to be clickable.
 */
export function DossierTrigger({
  id,
  label,
  className = "",
  children,
}: {
  id: string;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  const dossier = useDossier();

  if (!dossier) return <>{children}</>;

  return (
    <button
      type="button"
      onClick={() => dossier.open(id)}
      aria-haspopup="dialog"
      aria-label={`Open the dossier for ${label}`}
      className={`cursor-pointer border-0 bg-transparent p-0 text-left hover:text-stamp ${className}`}
      suppressHydrationWarning
    >
      {children}
    </button>
  );
}
