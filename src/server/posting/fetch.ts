import "server-only";

import { lookup } from "node:dns/promises";

import { isBlockedAddress } from "@/lib/posting/net";
import type { PostingFailure } from "@/lib/posting/types";

/**
 * The only place in Docket that opens an outbound connection to an address a
 * user chose. Everything here is a limit.
 *
 *   · Every hop is resolved and judged before it is followed, so a redirect
 *     cannot walk the request from a public host onto a private one.
 *   · Redirects are followed by hand, three at most.
 *   · The body is read in chunks against a hard ceiling, because Content-Length
 *     is a claim by the other end, not a fact.
 *   · No cookies, no credentials, a fixed timeout.
 *
 * One honest limitation: the address is checked at resolution and the socket is
 * opened by `fetch` a moment later, so a domain whose DNS answer changes
 * between the two could still slip through (a rebinding attack). Closing that
 * properly means dialling the resolved IP directly and carrying the Host header
 * ourselves. For a register that fetches public job adverts, resolve-and-judge
 * plus the redirect check is the proportionate control; if this endpoint ever
 * reaches untrusted input, pinning is the next thing to build.
 */

export const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 3;

const USER_AGENT =
  "DocketBot/1.0 (+https://docket.click; reads the job advert a signed-in user pasted)";

export type FetchOutcome =
  | { ok: true; body: string; url: URL; contentType: string }
  | { ok: false; reason: PostingFailure; message: string };

const unreachable = (message: string): FetchOutcome => ({
  ok: false,
  reason: "unreachable",
  message,
});

/** Resolves the host and refuses anything that is not a public address. */
async function assertPublicHost(url: URL): Promise<FetchOutcome | null> {
  const host = url.hostname.replace(/^\[|\]$/g, "");

  // A literal was already judged without DNS by inspectPostingUrl; re-judge it
  // here anyway, because this function is also the redirect gate.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) {
    return isBlockedAddress(host)
      ? { ok: false, reason: "private-host", message: "That link points inside a private network." }
      : null;
  }

  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    return unreachable("That host does not resolve.");
  }

  if (addresses.length === 0) return unreachable("That host does not resolve.");
  // Every answer must pass: one private record is enough to make the fetch unsafe.
  if (addresses.some((entry) => isBlockedAddress(entry.address))) {
    return {
      ok: false,
      reason: "private-host",
      message: "That link points inside a private network.",
    };
  }
  return null;
}

/** Reads the body with a ceiling, whatever the other end claims it is sending. */
async function readCapped(response: Response): Promise<string | null> {
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (declared > MAX_BYTES) return null;

  const body = response.body;
  if (!body) return await response.text();

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const merged = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    merged.set(chunk, at);
    at += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

export async function safeFetch(target: URL, accept: string): Promise<FetchOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    let url = target;

    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      const rejected = await assertPublicHost(url);
      if (rejected) return rejected;

      let response: Response;
      try {
        response = await fetch(url, {
          redirect: "manual",
          signal: controller.signal,
          cache: "no-store",
          credentials: "omit",
          headers: { accept, "user-agent": USER_AGENT, "accept-language": "en,*;q=0.5" },
        });
      } catch {
        return unreachable("Could not reach that link.");
      }

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) return unreachable("That link redirects nowhere.");
        try {
          url = new URL(location, url);
        } catch {
          return unreachable("That link redirects somewhere unreadable.");
        }
        if (url.protocol !== "https:" && url.protocol !== "http:") {
          return { ok: false, reason: "scheme", message: "That link redirects off the web." };
        }
        url.username = "";
        url.password = "";
        continue;
      }

      if (!response.ok) {
        return unreachable(
          response.status === 404
            ? "That advert is no longer there."
            : `The site answered ${response.status}.`,
        );
      }

      const body = await readCapped(response);
      if (body === null) {
        return { ok: false, reason: "too-large", message: "That page is larger than 2 MB." };
      }

      return {
        ok: true,
        body,
        url,
        contentType: response.headers.get("content-type") ?? "",
      };
    }

    return unreachable("That link redirects too many times.");
  } finally {
    clearTimeout(timer);
  }
}
