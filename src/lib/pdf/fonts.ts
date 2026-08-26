import {
  entry,
  field,
  isName,
  nameOf,
  resolve,
  streamData,
  type PdfFile,
  type PdfValue,
} from "./objects";

/**
 * Turning the bytes inside a text-showing operator back into text.
 *
 * A PDF string is not text. It is a sequence of character codes whose meaning
 * belongs to the font that was current when they were drawn, and the two cases
 * that matter here are as different as they look:
 *
 *   - A **simple font** uses one byte per glyph, and the byte is usually its
 *     WinAnsi code, so `(Loudly)` really does say Loudly. The writer in
 *     `lib/export/pdf` produces exactly this.
 *   - A **composite font** — what a modern word processor embeds — usually uses
 *     two bytes per glyph, and the number is an index into a subsetted font
 *     file. The code 0x0003 means nothing at all on its own; it means whatever
 *     the `ToUnicode` map the producer shipped beside it says it means.
 *
 * Which is why a CV exported from one tool reads perfectly and one exported
 * from another arrives as nonsense if this step is skipped. When a composite
 * font has no `ToUnicode`, its codes are unrecoverable, and this module says so
 * by decoding nothing rather than by inventing letters.
 */

export type FontDecoder = {
  decode: (raw: string) => string;
  /** Whether codes are read two bytes at a time. */
  twoByte: boolean;
  /** False when the font gave nothing to map its codes with. */
  readable: boolean;
};

/** The bytes WinAnsi puts where Latin-1 keeps control codes, in reverse. */
// prettier-ignore
const WIN_ANSI_HIGH: Record<number, string> = {
  0x80: "€", 0x82: "‚", 0x83: "ƒ", 0x84: "„", 0x85: "…",
  0x86: "†", 0x87: "‡", 0x88: "ˆ", 0x89: "‰", 0x8a: "Š",
  0x8b: "‹", 0x8c: "Œ", 0x8e: "Ž", 0x91: "‘", 0x92: "’",
  0x93: "“", 0x94: "”", 0x95: "•", 0x96: "–", 0x97: "—",
  0x98: "˜", 0x99: "™", 0x9a: "š", 0x9b: "›", 0x9c: "œ",
  0x9e: "ž", 0x9f: "Ÿ",
};

/**
 * Glyph names that a `/Differences` array uses and whose meaning is not simply
 * the character itself. The long tail — every accented letter — is handled by
 * the `uniXXXX` form and by names that are already one character.
 */
// prettier-ignore
const GLYPH_NAMES: Record<string, string> = {
  space: " ", exclam: "!", quotedbl: '"', numbersign: "#", dollar: "$",
  percent: "%", ampersand: "&", quotesingle: "'", parenleft: "(",
  parenright: ")", asterisk: "*", plus: "+", comma: ",", hyphen: "-",
  period: ".", slash: "/", zero: "0", one: "1", two: "2", three: "3",
  four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9",
  colon: ":", semicolon: ";", less: "<", equal: "=", greater: ">",
  question: "?", at: "@", bracketleft: "[", backslash: "\\", bracketright: "]",
  asciicircum: "^", underscore: "_", grave: "`", braceleft: "{", bar: "|",
  braceright: "}", asciitilde: "~",
  bullet: "•", endash: "–", emdash: "—",
  quoteleft: "‘", quoteright: "’", quotedblleft: "“",
  quotedblright: "”", ellipsis: "…", fi: "fi", fl: "fl",
  germandbls: "ß", adieresis: "ä", odieresis: "ö",
  udieresis: "ü", Adieresis: "Ä", Odieresis: "Ö",
  Udieresis: "Ü", eacute: "é", egrave: "è",
  ccedilla: "ç", atilde: "ã", otilde: "õ", aacute: "á",
  iacute: "í", oacute: "ó", uacute: "ú", ntilde: "ñ",
  agrave: "à", ocircumflex: "ô", acircumflex: "â",
  ecircumflex: "ê",
};

function glyphToText(name: string): string | null {
  if (GLYPH_NAMES[name]) return GLYPH_NAMES[name]!;
  if ([...name].length === 1) return name;

  const uni = /^uni([0-9A-Fa-f]{4})$/.exec(name);
  if (uni) return String.fromCharCode(Number.parseInt(uni[1]!, 16));

  const single = /^u([0-9A-Fa-f]{4,6})$/.exec(name);
  if (single) return String.fromCodePoint(Number.parseInt(single[1]!, 16));

  return null;
}

const winAnsiChar = (code: number) =>
  WIN_ANSI_HIGH[code] ?? (code >= 0x20 ? String.fromCharCode(code) : "");

/* -------------------------------------------------------------------------- */

/**
 * A `ToUnicode` CMap, which is itself a small PostScript program — but one
 * whose only interesting statements are two kinds of table.
 *
 *     beginbfchar  <0003> <0041>                       one code, one string
 *     beginbfrange <0024> <0027> <0061>                 a run of codes
 *     beginbfrange <0024> <0025> [<0061> <0062>]        a run, listed
 */
export function parseToUnicode(source: string): { map: Map<number, string>; twoByte: boolean } {
  const map = new Map<number, string>();

  const codespace = /begincodespacerange([\s\S]*?)endcodespacerange/.exec(source);
  const firstCode = codespace ? /<([0-9A-Fa-f]+)>/.exec(codespace[1]!) : null;
  const twoByte = firstCode ? firstCode[1]!.length > 2 : true;

  const hexText = (hex: string): string => {
    let out = "";
    for (let index = 0; index + 4 <= hex.length; index += 4) {
      const unit = Number.parseInt(hex.slice(index, index + 4), 16);
      if (!Number.isNaN(unit)) out += String.fromCharCode(unit);
    }
    return out;
  };

  for (const block of source.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const pair of block[1]!.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]*)>/g)) {
      map.set(Number.parseInt(pair[1]!, 16), hexText(pair[2]!));
    }
  }

  for (const block of source.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    const body = block[1]!;

    for (const range of body.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]*)>/g)) {
      const from = Number.parseInt(range[1]!, 16);
      const to = Number.parseInt(range[2]!, 16);
      const start = range[3]!;
      const base = Number.parseInt(start.slice(-4) || "0", 16);
      const prefix = start.length > 4 ? hexText(start.slice(0, -4)) : "";
      // A range longer than the whole of the BMP is a malformed file, not a font.
      for (let code = from; code <= to && code - from < 65_536; code += 1) {
        map.set(code, prefix + String.fromCharCode(base + (code - from)));
      }
    }

    for (const listed of body.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*\[([\s\S]*?)\]/g)) {
      const from = Number.parseInt(listed[1]!, 16);
      const items = [...listed[3]!.matchAll(/<([0-9A-Fa-f]*)>/g)];
      items.forEach((item, offset) => map.set(from + offset, hexText(item[1]!)));
    }
  }

  return { map, twoByte };
}

/* -------------------------------------------------------------------------- */

/** How the codes of one font resource are to be read. */
export function buildFont(file: PdfFile, fontValue: PdfValue): FontDecoder {
  const composite = nameOf(entry(file, fontValue, "Subtype")) === "Type0";

  const reference = field(fontValue, "ToUnicode");
  const toUnicode =
    reference !== null &&
    reference !== undefined &&
    typeof reference === "object" &&
    "num" in reference
      ? file.objects.get(Number(reference.num))
      : null;
  const cmapData = streamData(file, toUnicode);
  const cmap = cmapData ? parseToUnicode(cmapData.toString("latin1")) : null;

  const differences = buildDifferences(file, fontValue);

  const twoByte = cmap ? cmap.twoByte : composite;
  // A composite font with no map is a font whose codes cannot be read back.
  const readable = Boolean(cmap) || !composite;

  const decode = (raw: string): string => {
    if (!readable) return "";

    let out = "";
    const step = twoByte ? 2 : 1;

    for (let index = 0; index < raw.length; index += step) {
      const code =
        step === 2
          ? ((raw.charCodeAt(index) << 8) | (raw.charCodeAt(index + 1) || 0)) & 0xffff
          : raw.charCodeAt(index);

      const mapped = cmap?.map.get(code);
      if (mapped !== undefined) {
        out += mapped;
        continue;
      }

      // An unmapped code in a composite font is a glyph index, and guessing a
      // letter from it would be inventing text.
      if (composite) continue;

      out += differences.get(code) ?? winAnsiChar(code);
    }

    return out;
  };

  return { decode, twoByte, readable };
}

/** `/Differences [65 /A /B 200 /bullet]` — codes remapped to named glyphs. */
function buildDifferences(file: PdfFile, fontValue: PdfValue): Map<number, string> {
  const out = new Map<number, string>();

  const encoding = entry(file, fontValue, "Encoding");
  const differences = resolve(file, field(encoding, "Differences"));
  if (!Array.isArray(differences)) return out;

  let code = 0;
  for (const item of differences) {
    if (typeof item === "number") {
      code = item;
      continue;
    }
    if (item !== null && typeof item === "object" && isName(item)) {
      const text = glyphToText(item.name);
      if (text !== null) out.set(code, text);
      code += 1;
    }
  }

  return out;
}
