import { inflateRawSync } from "node:zlib";

/**
 * Reads back an archive written by `src/lib/export/zip.ts`.
 *
 * The tests assert on the XML inside a workbook, not on the bytes around it, so
 * they need an unzipper. This one understands exactly what that writer emits —
 * local headers in order, no zip64, no data descriptors — which also makes it a
 * second opinion on whether those headers are right: a wrong length or a wrong
 * method sends this off the rails immediately.
 */
export function readArchive(bytes: Uint8Array): Map<string, string> {
  const buffer = Buffer.from(bytes);
  const files = new Map<string, string>();
  let offset = 0;

  while (offset + 30 <= buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) {
    const method = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);

    const name = buffer.subarray(offset + 30, offset + 30 + nameLength).toString("utf8");
    const start = offset + 30 + nameLength + extraLength;
    const payload = buffer.subarray(start, start + compressedSize);

    files.set(name, (method === 8 ? inflateRawSync(payload) : payload).toString("utf8"));
    offset = start + compressedSize;
  }

  return files;
}
