/**
 * Splitting a line of the CV around the advert's terms, for the preview.
 *
 * The boundaries are the ones `containsTerm` uses, so a word is marked on the
 * page exactly when the keyword list says it is present: "java" is not marked
 * inside "javascript", and "go" is not marked in "go live" unless the advert
 * asked for Go. Case is ignored, and a hyphen and a space are the same thing.
 */
export type Segment = { text: string; match: boolean };

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function termPattern(term: string): string {
  return term
    .trim()
    .split(/[\s-]+/)
    .filter(Boolean)
    .map(escape)
    .join("[\\s-]+");
}

export function highlightSegments(text: string, terms: readonly string[]): Segment[] {
  const usable = [...new Set(terms.map((term) => term.trim()).filter((term) => term.length >= 2))]
    // Longest first, so "React Native" wins over "React" where both would match.
    .sort((a, b) => b.length - a.length)
    .map(termPattern);

  if (!text || usable.length === 0) return text ? [{ text, match: false }] : [];

  const pattern = new RegExp(
    `(?<![A-Za-z0-9#.])(?:${usable.join("|")})(?![A-Za-z0-9+#])`,
    "gi",
  );

  const segments: Segment[] = [];
  let last = 0;
  for (const found of text.matchAll(pattern)) {
    const start = found.index ?? 0;
    if (start > last) segments.push({ text: text.slice(last, start), match: false });
    segments.push({ text: found[0], match: true });
    last = start + found[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last), match: false });
  return segments;
}
