import { decodeEntities, stripTags } from "./html";
import { splitLocation } from "./location";
import type { PostingPartial, PostingSource } from "./types";

/**
 * Boards that publish a read-only JSON endpoint for a single posting.
 *
 * Cheaper and steadier than reading the rendered page: one small document,
 * no markup to guess at, and no client-side rendering to wait for. Ashby in
 * particular renders its board in the browser, so the page HTML alone would
 * often arrive empty.
 *
 * Every parser reads defensively and returns only the fields it actually found.
 * A board that changes its response shape degrades this layer to nothing and
 * the pipeline falls through to structured data — it cannot produce a wrong
 * value, only an absent one.
 */

export type BoardAdapter = {
  source: PostingSource;
  /** The JSON endpoint for this link, or null when the adapter does not recognise it. */
  match(url: URL): string | null;
  parse(payload: unknown, url: URL): PostingPartial;
};

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function str(source: unknown, ...path: string[]): string {
  let node: unknown = source;
  for (const key of path) {
    if (!isObject(node)) return "";
    node = node[key];
  }
  return typeof node === "string" ? node.trim() : "";
}

/** Board HTML arrives entity-encoded on Greenhouse; decode before stripping. */
function toText(html: string): string {
  return html ? stripTags(decodeEntities(html)) : "";
}

/**
 * Path segments, decoded once. `url.pathname` is still percent-encoded, and
 * every endpoint below re-encodes what it takes — without this, a slug that
 * legitimately contains an escape would be encoded twice and miss.
 */
function segments(url: URL): string[] {
  return url.pathname
    .split("/")
    .filter(Boolean)
    .map((part) => {
      try {
        return decodeURIComponent(part);
      } catch {
        return part;
      }
    });
}

/* -------------------------------------------------------------------------- */

const greenhouse: BoardAdapter = {
  source: "Greenhouse",
  match(url) {
    const host = url.hostname.toLowerCase();
    if (!/(^|\.)(job-)?boards\.greenhouse\.io$/.test(host)) return null;

    // /embed/job_app?for=board&token=id — the iframe form of the same posting.
    if (url.pathname.startsWith("/embed/job_app")) {
      const board = url.searchParams.get("for");
      const token = url.searchParams.get("token");
      return board && token
        ? `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs/${encodeURIComponent(token)}?content=true`
        : null;
    }

    // /board/jobs/123456
    const [board, jobs, id] = segments(url);
    if (!board || jobs !== "jobs" || !id) return null;
    return `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs/${encodeURIComponent(id)}?content=true`;
  },
  parse(payload) {
    const draft: PostingPartial = {};
    const title = str(payload, "title");
    if (title) draft.position = title;
    const company = str(payload, "company_name");
    if (company) draft.company = company;
    const content = toText(str(payload, "content"));
    if (content) draft.jobDescription = content;
    return { ...draft, ...splitLocation(str(payload, "location", "name")) };
  },
};

const lever: BoardAdapter = {
  source: "Lever",
  match(url) {
    if (!/(^|\.)lever\.co$/.test(url.hostname.toLowerCase())) return null;
    const [company, id] = segments(url);
    if (!company || !id) return null;
    return `https://api.lever.co/v0/postings/${encodeURIComponent(company)}/${encodeURIComponent(id)}`;
  },
  parse(payload, url) {
    const draft: PostingPartial = {};
    const title = str(payload, "text");
    if (title) draft.position = title;

    // descriptionPlain is already text; description is HTML. Prefer the former.
    const plain = str(payload, "descriptionPlain");
    const body = plain || toText(str(payload, "description"));
    const extra = str(payload, "additionalPlain");
    const full = [body, extra].filter(Boolean).join("\n\n");
    if (full) draft.jobDescription = full;

    const slug = segments(url)[0];
    if (slug) draft.company = slug.replace(/[-_]+/g, " ");

    return { ...draft, ...splitLocation(str(payload, "categories", "location")) };
  },
};

const ashby: BoardAdapter = {
  source: "Ashby",
  match(url) {
    if (!/(^|\.)ashbyhq\.com$/.test(url.hostname.toLowerCase())) return null;
    const [org, id] = segments(url);
    if (!org || !id) return null;
    return `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(org)}`;
  },
  parse(payload, url) {
    const wanted = segments(url)[1];
    const jobs = isObject(payload) && Array.isArray(payload["jobs"]) ? payload["jobs"] : [];
    const job = jobs.find((item) => isObject(item) && str(item, "id") === wanted);
    if (!job) return {};

    const draft: PostingPartial = {};
    const title = str(job, "title");
    if (title) draft.position = title;
    const org = segments(url)[0];
    if (org) draft.company = org.replace(/[-_]+/g, " ");
    // Present only on boards that opted into descriptions; absent is normal.
    const description = str(job, "descriptionPlain") || toText(str(job, "descriptionHtml"));
    if (description) draft.jobDescription = description;
    return { ...draft, ...splitLocation(str(job, "location")) };
  },
};

export const BOARD_ADAPTERS: readonly BoardAdapter[] = [greenhouse, lever, ashby];

export function adapterFor(url: URL): { adapter: BoardAdapter; endpoint: string } | null {
  for (const adapter of BOARD_ADAPTERS) {
    const endpoint = adapter.match(url);
    if (endpoint) return { adapter, endpoint };
  }
  return null;
}

/** Hosts whose domain belongs to the board, never to the hiring company. */
export function isBoardHost(hostname: string): boolean {
  return /(^|\.)(greenhouse\.io|lever\.co|ashbyhq\.com|workable\.com|personio\.de|smartrecruiters\.com|recruitee\.com|teamtailor\.com|bamboohr\.com|myworkdayjobs\.com|jobvite\.com|breezy\.hr|workday\.com)$/.test(
    hostname.toLowerCase(),
  );
}
