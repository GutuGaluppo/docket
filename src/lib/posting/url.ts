import { isBlockedAddress } from "./net";
import type { PostingFailure } from "./types";

/**
 * Sites that answer a server-side fetch with a block page, a login wall, or a
 * lawyer.
 *
 * LinkedIn's user agreement forbids automated retrieval outright, and both it
 * and Indeed reject datacentre IPs on sight. Rather than build something that
 * fails half the time and breaks a term of service the other half, the paste
 * box recognises these hosts and asks for the text instead — which costs the
 * user one extra copy and costs us no legal exposure at all. The stack detector
 * has always worked on pasted text; nothing is lost.
 */
const BLOCKED_HOSTS: readonly string[] = [
  "linkedin.com",
  "indeed.com",
  "glassdoor.com",
  "ziprecruiter.com",
  "monster.com",
  "dice.com",
];

export type UrlVerdict =
  { ok: true; url: URL } | { ok: false; reason: PostingFailure; message: string };

/** "docket.click" and "boards.docket.click" both match "docket.click". */
export function hostMatches(hostname: string, domain: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return host === domain || host.endsWith(`.${domain}`);
}

export function blockedHost(hostname: string): string | null {
  return BLOCKED_HOSTS.find((domain) => hostMatches(hostname, domain)) ?? null;
}

/**
 * Everything that can be decided about a URL without touching the network.
 * The DNS-level check lives in the server fetcher; this is the half that is
 * pure, and therefore the half that has tests.
 */
export function inspectPostingUrl(raw: string): UrlVerdict {
  const value = raw.trim();
  if (!value) {
    return { ok: false, reason: "empty", message: "Paste the link to the job advert." };
  }

  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`);
  } catch {
    return { ok: false, reason: "malformed", message: "That does not look like a link." };
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, reason: "scheme", message: "Only http and https links can be read." };
  }

  // A literal address skips DNS entirely, so it has to be judged here.
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) {
    if (isBlockedAddress(host)) {
      return {
        ok: false,
        reason: "private-host",
        message: "That address is on a private network. Paste a public link.",
      };
    }
  }

  // "localhost" and anything without a dot never resolve to a public advert.
  if (!url.hostname.includes(".") || url.hostname.toLowerCase() === "localhost") {
    return {
      ok: false,
      reason: "private-host",
      message: "That address is on a private network. Paste a public link.",
    };
  }

  const blocked = blockedHost(url.hostname);
  if (blocked) {
    return {
      ok: false,
      reason: "blocked-host",
      message: `${blocked} does not allow this. Copy the advert text into the field below instead — the tags still work.`,
    };
  }

  // Credentials in a URL are only ever there to be replayed at something.
  url.username = "";
  url.password = "";
  url.hash = "";
  return { ok: true, url };
}
