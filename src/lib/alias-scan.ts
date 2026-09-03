/**
 * The scanning engine behind every dictionary detector in the product.
 *
 * A detector is a dictionary plus this file. The stack detector reads
 * technologies out of a job ad; the benefit detector reads what the job offers
 * out of the same text. Both need the same three rules — longest alias wins, a
 * match may not start or end mid-word, and a span already claimed is not
 * offered twice — and getting any of them subtly wrong is how "java" starts
 * appearing inside "javascript".
 *
 * Pure and synchronous: no network, no DOM, no clock. That is what lets the
 * landing page hero run a detector in the browser and the import route run the
 * same one on the server over a stored description.
 */

/** The key is how the term is shown; the array holds every spelling an ad may use. */
export type Dictionary = Record<string, readonly string[]>;

export type AliasPair = { term: string; alias: string };

/**
 * Longest alias first. This ordering is what stops "React Native" from also
 * producing "React", and "health insurance" from also producing "insurance":
 * the longer alias claims the span before the shorter one is ever tried.
 */
export function aliasPairs(dictionary: Dictionary): readonly AliasPair[] {
  return Object.entries(dictionary)
    .flatMap(([term, aliases]) => aliases.map((alias) => ({ term, alias })))
    .sort((a, b) => b.alias.length - a.alias.length);
}

/** A match must not start in the middle of a word. */
const blocksLeft = (c: string) => /[a-z0-9#.]/.test(c);
/** …nor end in the middle of one. "java" inside "javascript" fails here. */
const blocksRight = (c: string) => /[a-z0-9+#]/.test(c);

/**
 * Finds dictionary terms in free text, in the order they appear, without
 * duplicates.
 */
export function scanAliases(text: string, pairs: readonly AliasPair[]): string[] {
  const haystack = text.toLowerCase();
  if (!haystack.trim()) return [];

  const claimed: Array<[number, number]> = [];
  const found: Array<{ term: string; at: number }> = [];
  const seen = new Set<string>();

  for (const { term, alias } of pairs) {
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
      if (!seen.has(term)) {
        seen.add(term);
        found.push({ term, at: start });
      }
    }
  }

  return found.sort((a, b) => a.at - b.at).map((f) => f.term);
}

/**
 * Merges detector output with the person's edits. `dismissed` are detected
 * terms they removed; `manual` are terms they typed in. Kept here so the form,
 * the import route and any future re-run agree on the same result — and so a
 * re-paste never resurrects something someone deliberately took off the list.
 */
export function resolveDetected(input: {
  detected: readonly string[];
  dismissed: readonly string[];
  manual: readonly string[];
}): string[] {
  const dismissed = new Set(input.dismissed.map((t) => t.toLowerCase()));
  const fromAd = input.detected.filter((term) => !dismissed.has(term.toLowerCase()));
  const known = new Set(fromAd.map((term) => term.toLowerCase()));
  const extras = input.manual.filter((term) => {
    const key = term.toLowerCase();
    if (known.has(key)) return false;
    known.add(key);
    return true;
  });
  return [...fromAd, ...extras];
}

/**
 * Rebuilds the two edit lists from a saved record.
 *
 * A detected list is derived from the description on every keystroke, so a
 * saved entry has to arrive as the *difference* between what the detector finds
 * in its description and what was actually stored. A term typed by hand is not
 * in the text and must be re-added as `manual`; a term the text produces but
 * the saved list does not contain was removed on purpose and must be re-added
 * as `dismissed`. Without both, opening an entry to fix a typo would silently
 * rewrite its lists.
 */
export function seedEdits(found: readonly string[], saved: readonly string[]) {
  const foundKeys = new Set(found.map((term) => term.toLowerCase()));
  const savedKeys = new Set(saved.map((term) => term.toLowerCase()));

  return {
    manual: saved.filter((term) => !foundKeys.has(term.toLowerCase())),
    dismissed: found.filter((term) => !savedKeys.has(term.toLowerCase())),
  };
}
