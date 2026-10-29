import { describe, expect, it } from "vitest";

import { highlightSegments } from "./highlight";

const marked = (text: string, terms: string[]) =>
  highlightSegments(text, terms)
    .filter((segment) => segment.match)
    .map((segment) => segment.text);

describe("highlighting terms in a line", () => {
  it("marks whole words, ignoring case, and keeps the text intact", () => {
    const text = "Built the subscription flow in react and TypeScript.";
    const segments = highlightSegments(text, ["React", "TypeScript"]);
    expect(segments.map((segment) => segment.text).join("")).toBe(text);
    expect(marked(text, ["React", "TypeScript"])).toEqual(["react", "TypeScript"]);
  });

  it("does not mark a term inside a longer word", () => {
    expect(marked("JavaScript and reaction times", ["Java", "React"])).toEqual([]);
  });

  it("keeps the punctuation that belongs to a name", () => {
    expect(marked("Shipped in Node.js, C++ and C#.", ["Node.js", "C++", "C#"])).toEqual([
      "Node.js",
      "C++",
      "C#",
    ]);
  });

  it("treats a hyphen and a space as the same", () => {
    expect(marked("Customer facing and customer-facing", ["customer-facing"])).toEqual([
      "Customer facing",
      "customer-facing",
    ]);
  });

  it("prefers the longer of two overlapping terms", () => {
    expect(marked("React Native apps", ["React", "React Native"])).toEqual(["React Native"]);
  });

  it("returns the line untouched when there is nothing to mark", () => {
    expect(highlightSegments("Plain text", [])).toEqual([{ text: "Plain text", match: false }]);
    expect(highlightSegments("", ["React"])).toEqual([]);
  });
});
