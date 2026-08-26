import type { TextRun } from "./content";

/**
 * Coordinates back into reading order.
 *
 * A page holds runs of text at positions; a CV holds lines, blocks and — often —
 * two columns. Nothing in the file says which, so it is inferred here, and the
 * inference that matters most is the gutter: a two-column CV read as one column
 * interleaves the sidebar with the work history, which turns
 *
 *     Experience        Skills
 *     Loudly            React
 *
 * into "Experience Skills Loudly React". Every later step — the parser, the
 * model, the person reviewing it — would then be working from a document that
 * says something the original never said.
 */

export type PageLine = {
  text: string;
  /** Where the line starts and ends, in points from the left edge. */
  x: number;
  endX: number;
  y: number;
  size: number;
  column: number;
};

/** Runs closer together than this share a line, relative to their size. */
const LINE_TOLERANCE = 0.45;

/** A horizontal jump wider than this, relative to size, is a word space. */
const WORD_GAP = 0.22;

/**
 * A vertical jump wider than this, relative to the page's usual line pitch,
 * ends a block. Measured against the pitch rather than against the font size
 * because leading is a design decision: the same 10pt text is set 12pt apart in
 * one CV and 18pt apart in another, and only the first of those would keep its
 * paragraphs if the font size were the yardstick.
 */
const BLOCK_GAP = 1.6;

/** A gutter narrower than this fraction of the page is just wide word spacing. */
const MIN_GUTTER = 0.045;

/** Neither side of a gutter may hold fewer lines than this, or it is not a column. */
const MIN_COLUMN_LINES = 4;

export function layoutPage(runs: readonly TextRun[]): { lines: PageLine[]; columns: number } {
  const drawn = runs.filter((run) => run.text.length > 0);
  if (drawn.length === 0) return { lines: [], columns: 0 };

  /**
   * The gutter is looked for before lines are assembled, not after.
   *
   * A heading in the sidebar and a heading in the main column share a baseline,
   * so assembling first would join them into one line — and a line that spans
   * the page crosses every candidate gutter, which is precisely how a
   * two-column CV disguises itself as a one-column one.
   */
  const gutter = findGutter(drawn.map((run) => ({ x: run.x, endX: run.x + run.width, y: run.y })));

  if (gutter === null) return { lines: assemble(drawn), columns: 1 };

  const left = assemble(drawn.filter((run) => run.x < gutter));
  const right = assemble(drawn.filter((run) => run.x >= gutter)).map((line) => ({
    ...line,
    column: 1,
  }));

  // Each column read through before the next one starts, which is the order a
  // person reads it in and the order its sections were meant to be understood.
  return { lines: [...left, ...right], columns: 2 };
}

/** Runs sharing a baseline, joined in the order they sit on it. */
function assemble(runs: readonly TextRun[]): PageLine[] {
  const sorted = [...runs].sort((a, b) => b.y - a.y || a.x - b.x);
  const groups: TextRun[][] = [];

  for (const run of sorted) {
    const current = groups[groups.length - 1];
    const reference = current?.[0];
    const tolerance = Math.max(1.5, (reference?.size ?? run.size) * LINE_TOLERANCE);

    if (reference && Math.abs(reference.y - run.y) <= tolerance) current.push(run);
    else groups.push([run]);
  }

  return groups
    .map((group) => {
      const ordered = [...group].sort((a, b) => a.x - b.x);
      const size = Math.max(...ordered.map((run) => run.size), 1);

      let text = "";
      let cursor = Number.NEGATIVE_INFINITY;

      for (const run of ordered) {
        const gap = run.x - cursor;
        // Runs are emitted per show operator, so a single word can arrive in
        // three pieces. Only a real gap becomes a space.
        if (cursor > Number.NEGATIVE_INFINITY && gap > size * WORD_GAP && !text.endsWith(" ")) {
          text += " ";
        }
        text += run.text;
        cursor = run.x + run.width;
      }

      const first = ordered[0]!;
      return {
        text: text.replace(/\s+/g, " ").trim(),
        x: first.x,
        endX: cursor,
        y: first.y,
        size,
        column: 0,
      };
    })
    .filter((line) => line.text.length > 0);
}

/**
 * The x where the page splits, if it does.
 *
 * A gutter is a vertical band no line crosses, wide enough not to be word
 * spacing, with a real amount of text on both sides. Scanning every candidate
 * position is affordable — a page is a few hundred points wide — and it means
 * the sidebar can be on either side, at any width.
 */
function findGutter(items: ReadonlyArray<{ x: number; endX: number; y: number }>): number | null {
  if (items.length < MIN_COLUMN_LINES * 2) return null;

  const left = Math.min(...items.map((item) => item.x));
  const right = Math.max(...items.map((item) => item.endX));
  const width = right - left;
  if (width <= 0) return null;

  let best: { position: number; span: number } | null = null;
  let bandStart: number | null = null;

  for (let position = left; position <= right; position += 2) {
    const crossed = items.some((item) => item.x < position && item.endX > position);

    if (!crossed) {
      bandStart ??= position;
      continue;
    }

    if (bandStart !== null) {
      const span = position - bandStart;
      if (!best || span > best.span) best = { position: bandStart + span / 2, span };
      bandStart = null;
    }
  }

  if (!best || best.span < width * MIN_GUTTER) return null;

  // Counted in baselines rather than in runs: ten words on one line are one
  // line of a column, and a column of one line is a caption, not a column.
  const baselines = (side: ReadonlyArray<{ y: number }>) =>
    new Set(side.map((item) => Math.round(item.y))).size;

  const onLeft = items.filter((item) => item.x < best!.position);
  const onRight = items.filter((item) => item.x >= best!.position);
  if (baselines(onLeft) < MIN_COLUMN_LINES || baselines(onRight) < MIN_COLUMN_LINES) return null;

  return best.position;
}

/**
 * The page as text, with a blank line wherever the layout left a real gap.
 *
 * The blank lines are not decoration: the CV parser reads headings and entries
 * off them, so a page flattened to one line per row and no blocks parses far
 * worse than one that kept its shape.
 */
export function pageText(lines: readonly PageLine[]): string {
  const pitch = medianPitch(lines);
  let out = "";
  let previous: PageLine | null = null;

  for (const line of lines) {
    if (previous) {
      const columnChanged = previous.column !== line.column;
      const gap = previous.y - line.y;
      // A negative gap means the reading order moved back up the page, which
      // only happens at the top of a new column.
      if (columnChanged || gap < 0 || gap > pitch * BLOCK_GAP) out += "\n";
    }
    out += `${line.text}\n`;
    previous = line;
  }

  return out;
}

/** The distance between consecutive lines, as this page usually sets it. */
function medianPitch(lines: readonly PageLine[]): number {
  const gaps: number[] = [];

  for (let index = 1; index < lines.length; index += 1) {
    const previous = lines[index - 1]!;
    const line = lines[index]!;
    if (previous.column !== line.column) continue;
    const gap = previous.y - line.y;
    if (gap > 0) gaps.push(gap);
  }

  if (gaps.length === 0) return Math.max(...lines.map((line) => line.size), 1) * 1.4;

  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)]!;
}
