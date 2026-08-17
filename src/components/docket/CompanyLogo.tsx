"use client";

import { useEffect, useState } from "react";

import { logoSources, probableDomain } from "@/lib/company/domain";

/**
 * Clearbit first, Google's favicon second, monogram last.
 *
 * The monogram is what the server renders, and the remote logo only replaces it
 * after mount. That ordering is the whole fix: a server-rendered <img> starts
 * loading before React hydrates, and if it fails in that window React never
 * replays the error — `onError` does not fire, the fallback never runs, and the
 * browser's broken-image icon stays on screen for good. It also swallowed
 * `onLoad`, which is what decides whether the mark becomes a link.
 *
 * Rendering the monogram first is hydration-safe by construction: server and
 * client agree on the first paint, and the swap happens in a later render.
 *
 * The mark becomes a link only when the domain is trustworthy: either the user
 * typed it, or Clearbit answered — which means the domain is a real company.
 * A guessed domain that only produced a favicon stays unlinked; sending
 * someone to a squatted address would be worse than showing no link.
 */
export function CompanyLogo({ company, website }: { company: string; website?: string | null }) {
  const domain = website || probableDomain(company);
  const sources = logoSources(domain);

  const [mounted, setMounted] = useState(false);
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setIndex(0);
    setLoaded(false);
  }, [domain]);

  const initial = (company.trim()[0] ?? "?").toUpperCase();
  const source = mounted ? sources[index] : undefined;
  const canLink = Boolean(domain) && (Boolean(website) || (index === 0 && loaded));

  const mark = source ? (
    // eslint-disable-next-line @next/next/no-img-element -- third-party logo hosts, 28px, nothing to optimise
    <img
      className="size-7 shrink-0 rounded-[3px] border border-rule bg-sheet object-contain p-0.5"
      src={source}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onLoad={() => setLoaded(true)}
      onError={() => setIndex((i) => i + 1)}
    />
  ) : (
    <span
      aria-hidden="true"
      className="flex size-7 shrink-0 items-center justify-center rounded-[3px] border border-stamp-edge bg-stamp-wash p-0.5 font-mono text-[13px] font-bold text-stamp"
    >
      {initial}
    </span>
  );

  if (!canLink) return mark;

  return (
    <a
      href={`https://${domain}`}
      target="_blank"
      rel="noopener noreferrer"
      title={`Open ${domain}`}
      className="inline-flex rounded-[3px]"
    >
      {mark}
    </a>
  );
}
