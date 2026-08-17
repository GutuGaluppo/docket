const LEGAL_SUFFIXES = /\b(gmbh|ltda|inc|llc|ag|sa|s\.a\.|bv|b\.v\.|corp|co|group)\b/g;

/** "https://www.loudly.com/careers" → "loudly.com". Whatever they paste, we keep the host. */
export function normalizeDomain(input: string): string {
  const value = input.trim().toLowerCase();
  if (!value) return "";
  const host = value
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#]/)[0];
  return (host ?? "").replace(/\s+/g, "");
}

/** A guess for when no website was given: "Loudly GmbH" → "loudly.com". */
export function probableDomain(companyName: string): string {
  const base = companyName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(LEGAL_SUFFIXES, "")
    .replace(/[^a-z0-9]/g, "");
  return base ? `${base}.com` : "";
}

export function logoSources(domain: string): string[] {
  if (!domain) return [];
  return [
    `https://logo.clearbit.com/${domain}`,
    `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
  ];
}
