import { buildFont, type FontDecoder } from "./fonts";
import {
  entry,
  field,
  isName,
  isRef,
  nameOf,
  parseValue,
  resolve,
  streamData,
  type PdfFile,
  type PdfValue,
} from "./objects";

/**
 * A content stream, read for the text in it and where that text sits.
 *
 * A page is a program: `BT` opens a text object, `Tf` chooses a font, `Tm` and
 * `Td` move the pen, and `Tj` and `TJ` draw. Nothing in it is a line or a
 * paragraph — those are inferences, and they are made in `layout.ts` from the
 * coordinates this module produces. The separation matters for CVs
 * specifically, because a two-column CV is only distinguishable from a
 * one-column one by where its runs are on the page.
 *
 * Positions are computed by multiplying the text matrix by the current
 * transformation matrix, which is the only way a page that was drawn scaled or
 * translated — a producer's habit, not an exception — lands in the right place.
 */

export type TextRun = {
  x: number;
  y: number;
  /** Effective font size, after the matrices have had their say. */
  size: number;
  text: string;
  /** Rough advance width, used to tell a word gap from a continuation. */
  width: number;
};

type Matrix = [number, number, number, number, number, number];

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

const multiply = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[1] * n[2],
  m[0] * n[1] + m[1] * n[3],
  m[2] * n[0] + m[3] * n[2],
  m[2] * n[1] + m[3] * n[3],
  m[4] * n[0] + m[5] * n[2] + n[4],
  m[4] * n[1] + m[5] * n[3] + n[5],
];

const translation = (x: number, y: number): Matrix => [1, 0, 0, 1, x, y];

/** Average glyph width as a fraction of the em, for gap detection only. */
const AVERAGE_GLYPH = 0.5;

/** A negative kern wider than this much of the em is a word space. */
const SPACE_KERN = 180;

const number = (value: PdfValue | undefined): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

export function readContent(
  file: PdfFile,
  source: string,
  resources: PdfValue,
  depth = 0,
): TextRun[] {
  const runs: TextRun[] = [];
  const fonts = new Map<string, FontDecoder>();

  let ctm: Matrix = IDENTITY;
  const ctmStack: Matrix[] = [];

  let tm: Matrix = IDENTITY;
  let tlm: Matrix = IDENTITY;
  let leading = 0;
  let fontSize = 0;
  let charSpacing = 0;
  let font: FontDecoder | null = null;

  const fontFor = (name: string): FontDecoder | null => {
    const cached = fonts.get(name);
    if (cached) return cached;

    const table = entry(file, resources, "Font");
    const chosen = resolve(file, field(table, name));
    if (chosen === null) return null;

    const decoder = buildFont(file, chosen);
    fonts.set(name, decoder);
    return decoder;
  };

  const show = (raw: string): void => {
    if (!font || !raw) return;

    const text = font.decode(raw);
    const matrix = multiply(tm, ctm);
    const scale = Math.hypot(matrix[0], matrix[1]) || 1;
    const size = fontSize * scale;
    const width = text.length * (fontSize * AVERAGE_GLYPH + charSpacing) * scale;

    if (text.trim() || text === " ") {
      runs.push({ x: matrix[4], y: matrix[5], size, text, width });
    }

    tm = multiply(translation(text.length * (fontSize * AVERAGE_GLYPH + charSpacing), 0), tm);
  };

  /**
   * A space where the pen jumped rather than where a space character was drawn.
   *
   * It has to be emitted as text rather than folded into the string being
   * shown: what a show operator holds is font codes, and a code in a two-byte
   * font is not a character — appending 0x20 to it would corrupt the pair.
   */
  const showSpace = (): void => {
    const matrix = multiply(tm, ctm);
    const scale = Math.hypot(matrix[0], matrix[1]) || 1;
    runs.push({ x: matrix[4], y: matrix[5], size: fontSize * scale, text: " ", width: 0 });
  };

  /** `TJ`: strings to draw, with kerning numbers between them. */
  const showArray = (items: PdfValue[]): void => {
    for (const item of items) {
      if (typeof item === "string") {
        show(item);
        continue;
      }
      if (typeof item !== "number") continue;

      // A positive number pulls the next glyph left, which is kerning inside a
      // word. A large negative one is how most producers write a word space.
      if (-item >= SPACE_KERN) showSpace();
      tm = multiply(translation((-item / 1000) * fontSize, 0), tm);
    }
  };

  const nextLine = (extra = 0) => {
    tlm = multiply(translation(0, -(leading + extra)), tlm);
    tm = tlm;
  };

  let operands: PdfValue[] = [];
  let index = 0;

  while (index < source.length) {
    const parsed = parseValue(source, index);
    if (parsed.end <= index) break;
    index = parsed.end;

    // A name and an operator parse identically — `/F1` and `Tf` are both bare
    // tokens — so the slash in the source is what tells them apart.
    const value = parsed.value;
    const named = value !== null && typeof value === "object" && isName(value);
    const operator = named && !isSlashName(source, parsed.end, value) ? value.name : null;

    if (operator === null) {
      operands.push(value);
      if (operands.length > 64) operands = operands.slice(-16);
      continue;
    }

    switch (operator) {
      case "q":
        ctmStack.push(ctm);
        break;
      case "Q":
        ctm = ctmStack.pop() ?? IDENTITY;
        break;
      case "cm":
        ctm = multiply(
          [
            number(operands[0]),
            number(operands[1]),
            number(operands[2]),
            number(operands[3]),
            number(operands[4]),
            number(operands[5]),
          ],
          ctm,
        );
        break;
      case "BT":
        tm = IDENTITY;
        tlm = IDENTITY;
        break;
      case "ET":
        break;
      case "Tf": {
        const name = nameOf(operands[operands.length - 2]);
        fontSize = number(operands[operands.length - 1]);
        font = name ? fontFor(name) : font;
        break;
      }
      case "TL":
        leading = number(operands[0]);
        break;
      case "Tc":
        charSpacing = number(operands[0]);
        break;
      case "Td":
        tlm = multiply(translation(number(operands[0]), number(operands[1])), tlm);
        tm = tlm;
        break;
      case "TD":
        leading = -number(operands[1]);
        tlm = multiply(translation(number(operands[0]), number(operands[1])), tlm);
        tm = tlm;
        break;
      case "Tm":
        tlm = [
          number(operands[0]),
          number(operands[1]),
          number(operands[2]),
          number(operands[3]),
          number(operands[4]),
          number(operands[5]),
        ];
        tm = tlm;
        break;
      case "T*":
        nextLine();
        break;
      case "Tj":
        if (typeof operands[0] === "string") show(operands[0]);
        break;
      case "'":
        nextLine();
        if (typeof operands[0] === "string") show(operands[0]);
        break;
      case '"':
        nextLine();
        if (typeof operands[2] === "string") show(operands[2]);
        break;
      case "TJ":
        if (Array.isArray(operands[0])) showArray(operands[0]);
        break;
      case "Do": {
        // A form is a page inside a page: some producers put whole columns in one.
        if (depth >= 3) break;
        const name = nameOf(operands[0]);
        if (!name) break;

        const xobjects = entry(file, resources, "XObject");
        const reference = field(xobjects, name);
        const object =
          reference !== undefined && reference !== null && isRef(reference)
            ? file.objects.get(reference.num)
            : null;
        if (!object) break;
        if (nameOf(entry(file, object.value, "Subtype")) !== "Form") break;

        const data = streamData(file, object);
        if (!data) break;

        const inner = entry(file, object.value, "Resources");
        const nested = readContent(file, data.toString("latin1"), inner ?? resources, depth + 1);
        // The form carries its own matrix; everything in it is placed by ours.
        for (const run of nested) {
          const placed = multiply(translation(run.x, run.y), ctm);
          runs.push({ ...run, x: placed[4], y: placed[5] });
        }
        break;
      }
      default:
        break;
    }

    operands = [];
  }

  return runs;
}

/**
 * Whether the token just read was written with a slash.
 *
 * `/F1 12 Tf` holds a name and an operator, and both parse the same way. The
 * source is the only place the difference survives.
 */
function isSlashName(source: string, end: number, value: PdfValue): boolean {
  if (value === null || typeof value !== "object" || !isName(value)) return false;
  const start = end - value.name.length - 1;
  return start >= 0 && source[start] === "/";
}
