import { deflateRawSync } from "node:zlib";

/**
 * The ZIP container, written by hand.
 *
 * An .xlsx is a zip of XML parts and nothing more, so the only thing standing
 * between this project and a real workbook was an archive writer. Reaching for
 * a spreadsheet library to get one would have pulled in a whole document object
 * model — styles, formulas, charts, a parser for files we never read — to
 * produce ten kilobytes of markup we already know how to write. The same
 * reasoning that keeps `ics.ts` hand-written applies: the format is small, it is
 * specified, and owning it is cheaper than owning a dependency.
 *
 * Only what a workbook needs is implemented: no directories, no zip64, no
 * encryption, no data descriptors. Sizes are known before a part is written, so
 * every header is complete on the first pass.
 */
export type ZipFile = { path: string; data: Uint8Array | string };

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Timestamps are fixed at the epoch the format starts from (1980-01-01).
 *
 * A zip normally stamps each entry with the moment it was written, which would
 * make two exports of an unchanged register differ byte for byte. Pinning it
 * keeps the output a function of the data alone — which is what makes the tests
 * below able to assert on bytes at all.
 */
const DOS_TIME = 0;
const DOS_DATE = 0x0021;

const bytes = (data: Uint8Array | string) =>
  typeof data === "string" ? new Uint8Array(Buffer.from(data, "utf8")) : data;

export function zipArchive(files: readonly ZipFile[]): Uint8Array<ArrayBuffer> {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.path, "utf8");
    const raw = bytes(file.data);
    const deflated = deflateRawSync(raw);
    // A part that grows under compression is stored as it is; method 0 is
    // always legal and never larger.
    const stored = deflated.length >= raw.length;
    const payload = stored ? Buffer.from(raw) : deflated;
    const checksum = crc32(raw);

    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(stored ? 0 : 8, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    name.copy(local, 30);

    const entry = Buffer.alloc(46 + name.length);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4); // version made by
    entry.writeUInt16LE(20, 6); // version needed
    entry.writeUInt16LE(0x0800, 8);
    entry.writeUInt16LE(stored ? 0 : 8, 10);
    entry.writeUInt16LE(DOS_TIME, 12);
    entry.writeUInt16LE(DOS_DATE, 14);
    entry.writeUInt32LE(checksum, 16);
    entry.writeUInt32LE(payload.length, 20);
    entry.writeUInt32LE(raw.length, 24);
    entry.writeUInt16LE(name.length, 28);
    entry.writeUInt16LE(0, 30); // extra
    entry.writeUInt16LE(0, 32); // comment
    entry.writeUInt16LE(0, 34); // disk
    entry.writeUInt16LE(0, 36); // internal attributes
    entry.writeUInt32LE(0, 38); // external attributes
    entry.writeUInt32LE(offset, 42);
    name.copy(entry, 46);

    locals.push(local, payload);
    central.push(entry);
    offset += local.length + payload.length;
  }

  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4); // this disk
  end.writeUInt16LE(0, 6); // disk with the directory
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20); // comment length

  return new Uint8Array(Buffer.concat([...locals, directory, end]));
}
