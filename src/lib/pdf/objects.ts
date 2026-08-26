import { inflateRawSync, inflateSync } from "node:zlib";

/**
 * A PDF, read far enough to get the text out of it.
 *
 * Written by hand, like the writer in `lib/export/pdf` and for the same
 * reasons: the part of the format that matters here is small, a parser is
 * testable against documents this project can itself produce, and a CV is
 * personal enough that the fewer third parties in its path the better.
 *
 * What is understood: indirect objects, dictionaries, arrays, names, strings,
 * references, streams with `FlateDecode`, and object streams — the container
 * modern producers pack most non-stream objects into. What is not: encryption,
 * `LZWDecode`, and cross-reference streams as an index. The last one costs
 * nothing, because objects are found by scanning the file rather than by
 * seeking through the table: a document whose xref is stale or wrong still
 * reads, which is the common case with files that have been edited.
 */

export type PdfName = { readonly name: string };
export type PdfRef = { readonly num: number; readonly gen: number };
export type PdfDict = { [key: string]: PdfValue };
export type PdfValue = number | string | boolean | null | PdfName | PdfRef | PdfValue[] | PdfDict;

export const isName = (value: PdfValue): value is PdfName =>
  typeof value === "object" && value !== null && "name" in value;

export const isRef = (value: PdfValue): value is PdfRef =>
  typeof value === "object" && value !== null && "num" in value && "gen" in value;

export const isDict = (value: PdfValue): value is PdfDict =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  !isName(value) &&
  !isRef(value);

/**
 * One entry of a dictionary.
 *
 * A dictionary is an index signature, and both a name and a reference satisfy
 * that shape structurally, so narrowing with `isDict` alone leaves the compiler
 * unsure which of the three it is holding. Reading through here says it once
 * instead of at every call site.
 */
export function field(value: PdfValue | undefined, key: string): PdfValue | undefined {
  if (value === undefined) return undefined;
  return isDict(value) ? (value as PdfDict)[key] : undefined;
}

const WHITESPACE = new Set([" ", "\n", "\r", "\t", "\f", "\0"]);
const DELIMITER = new Set(["(", ")", "<", ">", "[", "]", "{", "}", "/", "%"]);

/**
 * The file is read as Latin-1 — one byte, one character — so every offset in
 * this module is both a string index and a byte offset. That equivalence is
 * what makes stream boundaries computable at all.
 */
export function latin1(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("latin1");
}

/** One value, parsed at `pos`. Returns where it ended, so a caller can continue. */
export function parseValue(source: string, pos: number): { value: PdfValue; end: number } {
  let index = skip(source, pos);
  const character = source[index];

  if (character === undefined) return { value: null, end: index };

  if (character === "/") {
    let end = index + 1;
    while (end < source.length && !WHITESPACE.has(source[end]!) && !DELIMITER.has(source[end]!)) {
      end += 1;
    }
    return { value: { name: decodeName(source.slice(index + 1, end)) }, end };
  }

  if (character === "(") return parseLiteralString(source, index);
  if (source.startsWith("<<", index)) return parseDictionary(source, index);
  if (character === "<") return parseHexString(source, index);

  if (character === "[") {
    const items: PdfValue[] = [];
    index += 1;
    for (;;) {
      index = skip(source, index);
      if (index >= source.length || source[index] === "]") return { value: items, end: index + 1 };
      const item = parseValue(source, index);
      if (item.end <= index) return { value: items, end: index + 1 };
      items.push(item.value);
      index = item.end;
    }
  }

  if (source.startsWith("true", index)) return { value: true, end: index + 4 };
  if (source.startsWith("false", index)) return { value: false, end: index + 5 };
  if (source.startsWith("null", index)) return { value: null, end: index + 4 };

  // A number, or the "12 0 R" that only looks like one until the third token.
  const numeric = /^[+-]?[\d.]+/.exec(source.slice(index, index + 32));
  if (numeric) {
    const reference = /^(\d+)\s+(\d+)\s+R\b/.exec(source.slice(index, index + 32));
    if (reference) {
      return {
        value: { num: Number(reference[1]), gen: Number(reference[2]) },
        end: index + reference[0].length,
      };
    }
    return { value: Number(numeric[0]) || 0, end: index + numeric[0].length };
  }

  // An operator or something unparseable: hand back the token so content
  // streams can read it, and so nothing loops forever on a malformed file.
  let end = index;
  while (end < source.length && !WHITESPACE.has(source[end]!) && !DELIMITER.has(source[end]!)) {
    end += 1;
  }
  return {
    value: { name: source.slice(index, end === index ? index + 1 : end) },
    end: Math.max(end, index + 1),
  };
}

function skip(source: string, pos: number): number {
  let index = pos;
  for (;;) {
    while (index < source.length && WHITESPACE.has(source[index]!)) index += 1;
    // A comment runs to the end of the line and is not content.
    if (source[index] !== "%") return index;
    while (index < source.length && source[index] !== "\n" && source[index] !== "\r") index += 1;
  }
}

/** `#41` inside a name is an escaped byte — how a name holds a space or a slash. */
function decodeName(raw: string): string {
  return raw.replace(/#([0-9A-Fa-f]{2})/g, (_, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, 16)),
  );
}

function parseDictionary(source: string, pos: number): { value: PdfDict; end: number } {
  const dict: PdfDict = {};
  let index = pos + 2;

  for (;;) {
    index = skip(source, index);
    if (index >= source.length) return { value: dict, end: index };
    if (source.startsWith(">>", index)) return { value: dict, end: index + 2 };

    if (source[index] !== "/") {
      // Not a key. Step over it rather than giving up on the dictionary.
      const stray = parseValue(source, index);
      index = Math.max(stray.end, index + 1);
      continue;
    }

    const key = parseValue(source, index);
    index = key.end;
    const entry = parseValue(source, index);
    index = entry.end;

    if (isName(key.value)) dict[key.value.name] = entry.value;
  }
}

function parseLiteralString(source: string, pos: number): { value: string; end: number } {
  let out = "";
  let depth = 0;
  let index = pos;

  for (; index < source.length; index += 1) {
    const character = source[index]!;

    if (character === "\\") {
      const next = source[index + 1] ?? "";
      const octal = /^[0-7]{1,3}/.exec(source.slice(index + 1, index + 4));
      if (octal) {
        out += String.fromCharCode(Number.parseInt(octal[0], 8));
        index += octal[0].length;
        continue;
      }
      const escapes: Record<string, string> = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f" };
      // A backslash before a newline is a line continuation and yields nothing.
      if (next !== "\n" && next !== "\r") out += escapes[next] ?? next;
      index += 1;
      continue;
    }

    if (character === "(") {
      depth += 1;
      if (depth > 1) out += character;
      continue;
    }

    if (character === ")") {
      depth -= 1;
      if (depth === 0) return { value: out, end: index + 1 };
      out += character;
      continue;
    }

    if (depth > 0) out += character;
  }

  return { value: out, end: index };
}

function parseHexString(source: string, pos: number): { value: string; end: number } {
  const close = source.indexOf(">", pos);
  const end = close === -1 ? source.length : close;
  const digits = source.slice(pos + 1, end).replace(/[^0-9A-Fa-f]/g, "");
  // An odd number of digits is padded with a zero, per the specification.
  const padded = digits.length % 2 === 0 ? digits : `${digits}0`;

  let out = "";
  for (let index = 0; index < padded.length; index += 2) {
    out += String.fromCharCode(Number.parseInt(padded.slice(index, index + 2), 16));
  }
  return { value: out, end: end + 1 };
}

/* -------------------------------------------------------------------------- */

export type PdfObject = {
  num: number;
  value: PdfValue;
  /** Byte range of the raw stream payload, before any filter is undone. */
  stream: { start: number; end: number } | null;
};

export type PdfFile = {
  raw: string;
  objects: Map<number, PdfObject>;
  trailers: PdfDict[];
  encrypted: boolean;
};

const OBJECT_HEADER = /(\d{1,10})\s+(\d{1,5})\s+obj\b/g;

/**
 * Every object in the file, found by scanning rather than by trusting the
 * cross-reference table.
 *
 * Producers disagree about the table more often than they disagree about the
 * objects: an incrementally saved file has several, a linearised one has two,
 * and a file that lost a byte in transit has one that points at nothing. The
 * objects themselves are self-delimiting, so they can be read without it.
 */
export function readPdf(bytes: Uint8Array): PdfFile {
  const raw = latin1(bytes);
  const objects = new Map<number, PdfObject>();

  OBJECT_HEADER.lastIndex = 0;
  for (let match = OBJECT_HEADER.exec(raw); match; match = OBJECT_HEADER.exec(raw)) {
    const num = Number(match[1]);
    const bodyStart = match.index + match[0].length;
    const parsed = parseValue(raw, bodyStart);

    const afterValue = skip(raw, parsed.end);
    let stream: PdfObject["stream"] = null;

    if (raw.startsWith("stream", afterValue)) {
      let start = afterValue + "stream".length;
      if (raw[start] === "\r") start += 1;
      if (raw[start] === "\n") start += 1;

      const declared = field(parsed.value, "Length") ?? null;
      const end =
        typeof declared === "number" && declared > 0 && start + declared <= raw.length
          ? start + declared
          : findEndstream(raw, start);

      stream = { start, end };
    }

    objects.set(num, { num, value: parsed.value, stream });
  }

  const trailers = readTrailers(raw, objects);
  const file: PdfFile = {
    raw,
    objects,
    trailers,
    encrypted: trailers.some((trailer) => trailer.Encrypt !== undefined),
  };

  expandObjectStreams(file);
  return file;
}

/** `/Length` is sometimes an indirect reference, and sometimes simply wrong. */
function findEndstream(raw: string, start: number): number {
  const marker = raw.indexOf("endstream", start);
  if (marker === -1) return raw.length;
  let end = marker;
  if (raw[end - 1] === "\n") end -= 1;
  if (raw[end - 1] === "\r") end -= 1;
  return end;
}

function readTrailers(raw: string, objects: Map<number, PdfObject>): PdfDict[] {
  const trailers: PdfDict[] = [];

  let at = raw.indexOf("trailer");
  while (at !== -1) {
    const parsed = parseValue(raw, at + "trailer".length);
    if (isDict(parsed.value)) trailers.push(parsed.value);
    at = raw.indexOf("trailer", at + 1);
  }

  // A file written after PDF 1.5 may have no `trailer` keyword at all: the same
  // dictionary is the one on its cross-reference stream.
  for (const object of objects.values()) {
    if (!isDict(object.value)) continue;
    const type = field(object.value, "Type");
    if (type !== undefined && isName(type) && type.name === "XRef") {
      trailers.push(object.value as PdfDict);
    }
  }

  return trailers;
}

/** Follows a reference. Anything else is already the value. */
export function resolve(file: PdfFile, value: PdfValue | undefined): PdfValue {
  let current: PdfValue = value ?? null;
  // A reference to a reference is legal, and a cycle is not — stop either way.
  for (let hops = 0; hops < 8 && isRef(current); hops += 1) {
    current = file.objects.get(current.num)?.value ?? null;
  }
  return current;
}

export function dictOf(file: PdfFile, value: PdfValue | undefined): PdfDict | null {
  const resolved = resolve(file, value);
  return isDict(resolved) ? resolved : null;
}

export function nameOf(value: PdfValue | undefined): string | null {
  return value !== undefined && value !== null && isName(value) ? value.name : null;
}

/** A dictionary entry, resolved through any reference in the way. */
export function entry(file: PdfFile, value: PdfValue | undefined, key: string): PdfValue {
  return resolve(file, field(value, key));
}

/**
 * The bytes of a stream, with its filters undone.
 *
 * Null rather than an exception on anything unsupported or damaged: a font
 * whose stream will not inflate costs the glyph map for that font, and the
 * document still has the rest of its text.
 */
export function streamData(file: PdfFile, object: PdfObject | null | undefined): Buffer | null {
  if (!object?.stream || !isDict(object.value)) return null;

  const raw = Buffer.from(file.raw.slice(object.stream.start, object.stream.end), "latin1");
  const filter = resolve(file, field(object.value, "Filter"));
  const filters = (Array.isArray(filter) ? filter : [filter])
    .map((entry) => nameOf(entry))
    .filter((name): name is string => Boolean(name));

  let data: Buffer = raw;
  for (const name of filters) {
    if (name === "FlateDecode" || name === "Fl") {
      const inflated = inflate(data);
      if (!inflated) return null;
      data = inflated;
      continue;
    }
    if (name === "ASCIIHexDecode" || name === "AHx") {
      const hex = data
        .toString("latin1")
        .split(">")[0]!
        .replace(/[^0-9A-Fa-f]/g, "");
      data = Buffer.from(hex.length % 2 === 0 ? hex : `${hex}0`, "hex");
      continue;
    }
    // Anything else — LZW, JPX, DCT — is not text this module can read.
    return null;
  }

  return data;
}

function inflate(data: Buffer): Buffer | null {
  try {
    return inflateSync(data);
  } catch {
    // Producers occasionally emit a raw deflate stream, or leave a byte of
    // whitespace in front of the header. Both are recoverable.
    try {
      return inflateRawSync(data);
    } catch {
      try {
        return inflateSync(data.subarray(1));
      } catch {
        return null;
      }
    }
  }
}

/**
 * Objects packed inside an object stream, unpacked into the same map.
 *
 * A modern producer puts almost every dictionary that is not itself a stream
 * into one of these, so without this step a file's fonts — and with them every
 * glyph map — are simply invisible.
 */
function expandObjectStreams(file: PdfFile): void {
  for (const object of [...file.objects.values()]) {
    if (!isDict(object.value)) continue;
    if (nameOf(field(object.value, "Type") ?? null) !== "ObjStm") continue;

    const data = streamData(file, object);
    if (!data) continue;

    const source = data.toString("latin1");
    const count = Number(resolve(file, field(object.value, "N")) ?? 0);
    const first = Number(resolve(file, field(object.value, "First")) ?? 0);
    if (!count || !first) continue;

    const header = source.slice(0, first).trim().split(/\s+/).map(Number);
    for (let index = 0; index < count; index += 1) {
      const num = header[index * 2];
      const offset = header[index * 2 + 1];
      if (num === undefined || offset === undefined || Number.isNaN(num)) continue;
      if (file.objects.has(num)) continue;

      const parsed = parseValue(source, first + offset);
      file.objects.set(num, { num, value: parsed.value, stream: null });
    }
  }
}
