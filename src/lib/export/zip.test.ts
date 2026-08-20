import { describe, expect, it } from "vitest";

import { readArchive } from "@/test/zip";
import { crc32, zipArchive } from "./zip";

describe("crc32", () => {
  it("agrees with the published check value", () => {
    // The standard test vector for CRC-32: "123456789" is 0xcbf43926.
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });
});

describe("zipArchive", () => {
  it("round-trips every part it was given", () => {
    const archive = readArchive(
      zipArchive([
        { path: "a.xml", data: "<a/>" },
        { path: "nested/b.xml", data: "<b>" + "x".repeat(5_000) + "</b>" },
      ]),
    );

    expect([...archive.keys()]).toEqual(["a.xml", "nested/b.xml"]);
    expect(archive.get("a.xml")).toBe("<a/>");
    expect(archive.get("nested/b.xml")).toContain("x".repeat(5_000));
  });

  it("keeps text intact through the encoding it declares", () => {
    const archive = readArchive(zipArchive([{ path: "c.xml", data: "<c>São Paulo · Café</c>" }]));
    expect(archive.get("c.xml")).toBe("<c>São Paulo · Café</c>");
  });

  it("ends with a central directory that counts what it holds", () => {
    const bytes = zipArchive([
      { path: "a.xml", data: "<a/>" },
      { path: "b.xml", data: "<b/>" },
    ]);
    const end = Buffer.from(bytes).subarray(bytes.length - 22);

    expect(end.readUInt32LE(0)).toBe(0x06054b50);
    expect(end.readUInt16LE(8)).toBe(2);
    expect(end.readUInt16LE(10)).toBe(2);
  });

  it("is a function of the data alone, so the same register exports the same bytes", () => {
    const once = zipArchive([{ path: "a.xml", data: "<a/>" }]);
    const twice = zipArchive([{ path: "a.xml", data: "<a/>" }]);
    expect(Buffer.from(once).equals(Buffer.from(twice))).toBe(true);
  });

  it("stores a part that compression would only make bigger", () => {
    // Four bytes of XML deflate to more than four bytes; the writer notices.
    const bytes = zipArchive([{ path: "a.xml", data: "<a/>" }]);
    expect(Buffer.from(bytes).readUInt16LE(8)).toBe(0);
    expect(readArchive(bytes).get("a.xml")).toBe("<a/>");
  });
});
