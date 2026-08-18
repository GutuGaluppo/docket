import "server-only";

import { adapterFor } from "@/lib/posting/adapters";
import { draftFromPage } from "@/lib/posting/heuristics";
import { jsonLdBlocks } from "@/lib/posting/html";
import { draftFromJsonLd } from "@/lib/posting/jsonld";
import { mergeDraft, type Contribution } from "@/lib/posting/merge";
import { inspectPostingUrl } from "@/lib/posting/url";
import type { PostingPartial, PostingResult } from "@/lib/posting/types";

import { safeFetch } from "./fetch";

/**
 * A pasted link, turned into a draft of the entry.
 *
 * Three layers, most to least trustworthy: the board's own API for the boards
 * that publish one, the page's schema.org/JobPosting block, then whatever can
 * be read off the markup. `mergeDraft` lets a later layer fill a gap and never
 * overwrite, so the order below is the whole reliability model.
 *
 * At most two requests leave the server per paste, and the page is skipped
 * entirely when the board API already answered everything that matters.
 */

/** The fields that decide whether a second request is worth making. */
function needsPage(partial: PostingPartial): boolean {
  return !partial.position || !partial.jobDescription || !partial.company;
}

export async function resolvePosting(raw: string): Promise<PostingResult> {
  const verdict = inspectPostingUrl(raw);
  if (!verdict.ok) return { ok: false, reason: verdict.reason, message: verdict.message };

  const url = verdict.url;
  const contributions: Contribution[] = [];

  // 1 — the board's own endpoint, when the link is one we recognise.
  const board = adapterFor(url);
  if (board) {
    const answer = await safeFetch(new URL(board.endpoint), "application/json");
    if (answer.ok) {
      try {
        const partial = board.adapter.parse(JSON.parse(answer.body) as unknown, url);
        if (Object.values(partial).some(Boolean)) {
          contributions.push({ source: board.adapter.source, partial });
        }
      } catch {
        // A board that changed its shape contributes nothing and blocks nothing.
      }
    }
  }

  const fromBoard = contributions[0]?.partial ?? {};

  // 2 and 3 — the page itself, read twice over: its structured data first,
  // then its markup.
  if (needsPage(fromBoard)) {
    const page = await safeFetch(url, "text/html,application/xhtml+xml");
    if (!page.ok) {
      // A board answer already in hand is worth more than the page error.
      if (contributions.length === 0)
        return { ok: false, reason: page.reason, message: page.message };
    } else {
      const structured = draftFromJsonLd(jsonLdBlocks(page.body));
      if (Object.values(structured).some(Boolean)) {
        contributions.push({ source: "structured data", partial: structured });
      }
      contributions.push({ source: "page text", partial: draftFromPage(page.body, page.url) });
    }
  }

  const draft = mergeDraft(contributions);
  if (draft.filled.length === 0) {
    return {
      ok: false,
      reason: "nothing-found",
      message: "Nothing readable on that page. Paste the advert text below instead.",
    };
  }

  return { ok: true, draft };
}
