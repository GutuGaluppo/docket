/**
 * What a pasted link turns into before it reaches the form.
 *
 * Every layer of the pipeline — board adapter, JSON-LD, page heuristics —
 * returns a `PostingPartial`, and they are merged field by field with the first
 * non-empty value winning. A layer that guesses wrong about one site can only
 * fail to contribute; it can never overwrite what a more reliable layer already
 * found. That is what makes it safe to add adapters for boards whose exact
 * response shape we cannot verify from here.
 */

export const POSTING_FIELDS = [
  "company",
  "website",
  "position",
  "city",
  "country",
  "jobDescription",
] as const;

export type PostingField = (typeof POSTING_FIELDS)[number];

export type PostingPartial = Partial<Record<PostingField, string>>;

/** Written out to the user, so a filled value is never anonymous. */
export type PostingSource = "Greenhouse" | "Lever" | "Ashby" | "structured data" | "page text";

export type PostingDraft = {
  values: Record<PostingField, string>;
  /** Exactly the fields that received a value — the review UI marks these and no others. */
  filled: PostingField[];
  /** In the order they contributed. */
  sources: PostingSource[];
};

export type PostingFailure =
  | "empty"
  | "malformed"
  | "scheme"
  | "private-host"
  | "blocked-host"
  | "unreachable"
  | "too-large"
  | "nothing-found";

export type PostingResult =
  { ok: true; draft: PostingDraft } | { ok: false; reason: PostingFailure; message: string };

export const EMPTY_VALUES: Record<PostingField, string> = {
  company: "",
  website: "",
  position: "",
  city: "",
  country: "",
  jobDescription: "",
};
