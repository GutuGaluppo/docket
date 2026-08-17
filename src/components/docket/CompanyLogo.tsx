"use client";

import { useEffect, useState } from "react";

import { logoSources, probableDomain } from "@/lib/company/domain";

/**
 * Clearbit first, Google's favicon second, monogram last.
 *
 * The mark becomes a link only when the domain is trustworthy: either the user
 * typed it, or Clearbit answered — which means the domain is a real company.
 * A guessed domain that only produced a favicon stays unlinked; sending
 * someone to a squatted address would be worse than showing no link.
 */
export function CompanyLogo({ company, website }: { company: string; website?: string | null }) {
  const domain = website || probableDomain(company);
  const sources = logoSources(domain);

  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setIndex(0);
    setLoaded(false);
  }, [domain]);

  const initial = (company.trim()[0] ?? "?").toUpperCase();
  const exhausted = index >= sources.length;
  const canLink = Boolean(domain) && (Boolean(website) || (index === 0 && loaded));

  const mark = exhausted ? (
    <span
      aria-hidden="true"
      className="flex size-7 shrink-0 items-center justify-center rounded-[3px] border border-stamp/30 bg-stamp/8 p-0.5 font-mono text-[13px] font-bold text-stamp"
    >
      {initial}
    </span>
  ) : (
    // eslint-disable-next-line @next/next/no-img-element -- third-party logo hosts, sized 28px, no optimisation to gain
    <img
      className="size-7 shrink-0 rounded-[3px] border border-rule bg-sheet object-contain p-0.5"
      src={sources[index]}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onLoad={() => setLoaded(true)}
      onError={() => setIndex((i) => i + 1)}
    />
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
