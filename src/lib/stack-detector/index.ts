import { TECHNOLOGIES } from "./dictionary";

export { TECHNOLOGIES, KNOWN_TAGS } from "./dictionary";

type AliasPair = { tag: string; alias: string };

/**
 * Longest alias first. This ordering is what stops "React Native" from also
 * producing "React": the longer alias claims the span before the shorter one
 * is ever tried.
 */
const ALIAS_PAIRS: readonly AliasPair[] = Object.entries(TECHNOLOGIES)
  .flatMap(([tag, aliases]) => aliases.map((alias) => ({ tag, alias })))
  .sort((a, b) => b.alias.length - a.alias.length);

/** A match must not start in the middle of a word. */
const blocksLeft = (c: string) => /[a-z0-9#.]/.test(c);
/** …nor end in the middle of one. "java" inside "javascript" fails here. */
const blocksRight = (c: string) => /[a-z0-9+#]/.test(c);

/**
 * Finds technologies in a pasted job ad.
 *
 * Pure and synchronous: no network, no DOM, no clock. That is what lets the
 * landing page hero run it client-side and the import route run it on the
 * server over the stored job description.
 *
 * Returns tags in the order they appear in the text, without duplicates.
 */
export function detectStack(text: string): string[] {
  const haystack = text.toLowerCase();
  if (!haystack.trim()) return [];

  const claimed: Array<[number, number]> = [];
  const found: Array<{ tag: string; at: number }> = [];
  const seen = new Set<string>();

  for (const { tag, alias } of ALIAS_PAIRS) {
    let from = 0;
    for (;;) {
      const start = haystack.indexOf(alias, from);
      if (start === -1) break;
      from = start + 1;

      const end = start + alias.length;
      const left = start > 0 ? (haystack[start - 1] ?? " ") : " ";
      const right = end < haystack.length ? (haystack[end] ?? " ") : " ";
      if (blocksLeft(left) || blocksRight(right)) continue;
      if (claimed.some(([a, b]) => start < b && end > a)) continue;

      claimed.push([start, end]);
      if (!seen.has(tag)) {
        seen.add(tag);
        found.push({ tag, at: start });
      }
    }
  }

  return found.sort((a, b) => a.at - b.at).map((f) => f.tag);
}

/**
 * Merges detector output with the user's edits. `dismissed` are detected tags
 * the user removed; `manual` are tags they typed in. Kept here so the form,
 * the import route and any future re-run agree on the same result.
 */
export function resolveTags(input: {
  detected: readonly string[];
  dismissed: readonly string[];
  manual: readonly string[];
}): string[] {
  const dismissed = new Set(input.dismissed.map((t) => t.toLowerCase()));
  const fromAd = input.detected.filter((tag) => !dismissed.has(tag.toLowerCase()));
  const known = new Set(fromAd.map((tag) => tag.toLowerCase()));
  const extras = input.manual.filter((tag) => {
    const key = tag.toLowerCase();
    if (known.has(key)) return false;
    known.add(key);
    return true;
  });
  return [...fromAd, ...extras];
}
