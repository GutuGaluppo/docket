/**
 * Term matching, and the one place its rules live.
 *
 * Everything downstream — coverage, the score, the gap list — is built on the
 * question "does this term appear in this text?", and the answer has to survive
 * the ways a job advert and a CV disagree about spelling: case, accents, curly
 * quotes, hyphens, and the punctuation that is part of a name rather than
 * around it. `C++`, `Node.js` and `.NET` are terms; `c` and `net` are not.
 */

/**
 * Lowercases, strips accents and collapses whitespace, keeping the characters
 * that belong to technology names. Everything else becomes a space, which is
 * what turns "React/Redux," into two findable terms.
 */
export function normalize(text: string): string {
  return ` ${text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’'`]/g, "")
    .replace(/[^a-z0-9+#.\-\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
}

/** A match must not start in the middle of a word… */
const blocksLeft = (character: string) => /[a-z0-9#.]/.test(character);
/** …nor end in the middle of one: "java" inside "javascript" fails here. */
const blocksRight = (character: string) => /[a-z0-9+#]/.test(character);

/**
 * Whether a normalised haystack contains a term as a whole word.
 *
 * The boundary rules are the ones the stack detector already uses, for the same
 * reason: "go" must not match "go live", and "react" must not match inside
 * "reaction". Terms shorter than two characters never match at all.
 */
export function containsTerm(haystack: string, term: string): boolean {
  const needle = normalize(term).trim();
  if (needle.length < 2) return false;

  let from = 0;
  for (;;) {
    const start = haystack.indexOf(needle, from);
    if (start === -1) return false;
    from = start + 1;

    const end = start + needle.length;
    const left = start > 0 ? (haystack[start - 1] ?? " ") : " ";
    const right = end < haystack.length ? (haystack[end] ?? " ") : " ";
    if (!blocksLeft(left) && !blocksRight(right)) return true;
  }
}

/** Whether any of the terms appears. */
export function containsAny(haystack: string, terms: readonly string[]): string | null {
  for (const term of terms) {
    if (containsTerm(haystack, term)) return term;
  }
  return null;
}

/** How many of the terms appear. Multi-term requirements are matched in part. */
export function countMatches(haystack: string, terms: readonly string[]): number {
  return terms.reduce((total, term) => total + (containsTerm(haystack, term) ? 1 : 0), 0);
}

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "you",
  "your",
  "our",
  "are",
  "will",
  "that",
  "this",
  "have",
  "has",
  "from",
  "who",
  "into",
  "about",
  "their",
  "them",
  "they",
  "its",
  "not",
  "but",
  "all",
  "can",
  "were",
  "been",
  "was",
  "use",
  "used",
  "using",
  "work",
  "working",
  "also",
  "role",
  "team",
  "teams",
  "join",
  "looking",
  "seeking",
  "ideal",
  "candidate",
  "company",
  "position",
  "job",
  "experience",
  "years",
  "year",
  "strong",
  "good",
  "great",
  "excellent",
  "ability",
  "able",
  "help",
  "helping",
  "plus",
  "nice",
  "must",
  "should",
  "would",
  "could",
  "well",
  "more",
  "most",
  "other",
  "within",
  "across",
  "every",
  "each",
  "some",
  "any",
  "what",
  "when",
  "where",
  "which",
  "while",
  "than",
  "then",
  "there",
  "here",
  "min",
  "max",
  "etc",
  "per",
  "via",
  "new",
  "one",
  "two",
  "three",
  "full",
  "time",
  "part",
  "level",
]);

/**
 * The words of a phrase that carry its meaning — what is left after the
 * grammar. Used to turn a requirement sentence into something matchable.
 */
export function keyTerms(phrase: string): string[] {
  const seen = new Set<string>();
  return normalize(phrase)
    .split(" ")
    .map((word) => word.replace(/^[.\-]+|[.\-]+$/g, ""))
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word) && !/^\d+$/.test(word))
    .filter((word) => (seen.has(word) ? false : (seen.add(word), true)));
}

export { STOP_WORDS };
