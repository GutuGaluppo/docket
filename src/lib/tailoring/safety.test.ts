import { describe, expect, it } from "vitest";

import { sampleResume } from "@/test/resume";

import { groundSuggestions, unsupportedNumbers, unsupportedSkills } from "./safety";
import type { ResumeSuggestion } from "./types";

const resume = sampleResume();

function suggestion(overrides: Partial<ResumeSuggestion> = {}): ResumeSuggestion {
  return {
    id: "m-1",
    targetSectionId: "experience",
    targetEntryId: "exp-loudly",
    targetFieldId: "bullets",
    targetItemId: "bul-1",
    type: "weak_wording",
    priority: "medium",
    title: "Lead with the work",
    reason: "Opening with a hedge understates it.",
    affects: ["experienceRelevance"],
    requiresConfirmation: false,
    source: "model",
    status: "pending",
    ...overrides,
  };
}

describe("numbers that the CV does not support", () => {
  it("finds the invented ones", () => {
    expect(unsupportedNumbers("Improved load time by 40%", ["Improved load time"])).toEqual(["40"]);
  });

  it("accepts a figure the CV already states", () => {
    expect(
      unsupportedNumbers("Cut failed payments by 12%", ["reducing failed payments by 12%"]),
    ).toEqual([]);
  });

  it("accepts text with no figures at all", () => {
    expect(unsupportedNumbers("Owned the playback surface", ["Worked on playback"])).toEqual([]);
  });
});

describe("technologies that the CV does not support", () => {
  it("finds one the document never mentions", () => {
    expect(
      unsupportedSkills("Built GraphQL APIs for the player", "React and TypeScript work"),
    ).toEqual(["GraphQL"]);
  });

  it("accepts one the document already claims", () => {
    expect(unsupportedSkills("Built the player in React", "React and TypeScript work")).toEqual([]);
  });
});

describe("reading every suggestion back against the document", () => {
  it("keeps a rewrite that only uses what is already there", () => {
    const { suggestions } = groundSuggestions(resume, [
      suggestion({
        suggestedText: "Owned frontend performance across the playback surface.",
      }),
    ]);

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]!.suggestedText).toBe(
      "Owned frontend performance across the playback surface.",
    );
    expect(suggestions[0]!.type).toBe("weak_wording");
  });

  it("strips a metric the CV never recorded and asks instead of asserting", () => {
    const { suggestions, stripped } = groundSuggestions(resume, [
      suggestion({
        suggestedText: "Improved frontend performance by 35% across the playback surface.",
      }),
    ]);

    expect(stripped).toBe(1);
    expect(suggestions[0]!.suggestedText).toBeUndefined();
    expect(suggestions[0]!.type).toBe("missing_evidence");
    expect(suggestions[0]!.requiresConfirmation).toBe(true);
  });

  it("strips a skill the CV does not have and reports it as a gap", () => {
    const { suggestions } = groundSuggestions(resume, [
      suggestion({ suggestedText: "Built GraphQL APIs for the playback surface." }),
    ]);

    expect(suggestions[0]!.suggestedText).toBeUndefined();
    expect(suggestions[0]!.type).toBe("missing_requirement");
    expect(suggestions[0]!.reason).toMatch(/GraphQL/);
  });

  it("drops a suggestion whose target no longer exists", () => {
    const { suggestions, dropped } = groundSuggestions(resume, [
      suggestion({ targetEntryId: "exp-deleted", targetItemId: "bul-gone" }),
    ]);

    expect(dropped).toBe(1);
    expect(suggestions).toHaveLength(0);
  });

  it("drops a rewrite identical to the text it would replace", () => {
    const { suggestions } = groundSuggestions(resume, [
      suggestion({ suggestedText: "Worked on frontend performance across the playback surface." }),
    ]);

    expect(suggestions).toHaveLength(0);
  });

  it("replaces whatever the model claimed the current text is", () => {
    const { suggestions } = groundSuggestions(resume, [
      suggestion({ currentText: "something the bullet never said" }),
    ]);

    expect(suggestions[0]!.currentText).toBe(
      "Worked on frontend performance across the playback surface.",
    );
  });
});
