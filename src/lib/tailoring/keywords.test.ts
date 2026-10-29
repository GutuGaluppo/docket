import { describe, expect, it } from "vitest";

import { SAMPLE_JOB, sampleResume } from "@/test/resume";

import { readJobDescription } from "./heuristics";
import { highlightTerms, keywordCoverage, keywordTally, sortKeywords } from "./keywords";
import type { JobKeyword } from "./types";

const keyword = (text: string, extra: Partial<JobKeyword> = {}): JobKeyword => ({
  id: `kw-${text}`,
  text,
  weight: "primary",
  occurrences: 1,
  ...extra,
});

describe("keyword coverage", () => {
  it("finds a term as a whole word and says which spelling the CV used", () => {
    const list = keywordCoverage(sampleResume(), [
      keyword("React"),
      keyword("Java"),
      keyword("Kubernetes", { aliases: ["Docker"] }),
    ]);

    expect(list.map((entry) => entry.foundAs)).toEqual(["React", null, "Docker"]);
  });

  it("agrees with the stored reading on a real advert", () => {
    const analysis = readJobDescription(SAMPLE_JOB);
    const list = keywordCoverage(sampleResume(), analysis.keywords);
    expect(list).toHaveLength(analysis.keywords.length);
    expect(keywordTally(list).found).toBeGreaterThan(0);
    expect(keywordTally(list).found).toBeLessThan(list.length);
  });

  it("puts missing primary terms first, most repeated first", () => {
    const sorted = sortKeywords(
      keywordCoverage(sampleResume(), [
        keyword("Git", { weight: "secondary" }),
        keyword("React"),
        keyword("GraphQL", { occurrences: 1 }),
        keyword("Next.js", { occurrences: 3 }),
      ]),
    );
    expect(sorted.map((entry) => entry.text)).toEqual(["Next.js", "GraphQL", "React", "Git"]);
  });

  it("offers each spelling the CV uses once, for marking on the page", () => {
    const list = keywordCoverage(sampleResume(), [
      keyword("React"),
      keyword("React.js", { aliases: ["React"] }),
      keyword("GraphQL"),
    ]);
    expect(highlightTerms(list)).toEqual(["React"]);
  });
});
