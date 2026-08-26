import { describe, expect, it } from "vitest";

import { resumeElements } from "@/lib/resume/target";
import { sampleResume } from "@/test/resume";

import { applySuggestion, revertChange } from "./apply";
import type { ResumeSuggestion } from "./types";

const resume = sampleResume();

const suggestion: ResumeSuggestion = {
  id: "m-1",
  targetSectionId: "experience",
  targetEntryId: "exp-loudly",
  targetFieldId: "bullets",
  targetItemId: "bul-1",
  type: "weak_wording",
  priority: "medium",
  title: "Lead with the work",
  reason: "Opening with a hedge understates it.",
  currentText: "Worked on frontend performance across the playback surface.",
  suggestedText: "Owned frontend performance across the playback surface.",
  affects: ["experienceRelevance"],
  requiresConfirmation: false,
  source: "model",
  status: "pending",
};

const textOf = (document: ReturnType<typeof sampleResume>, key: string) =>
  resumeElements(document).find((element) => element.key === key)?.text;

describe("applying a suggestion", () => {
  it("writes only the element it names", () => {
    const applied = applySuggestion(resume, suggestion, suggestion.suggestedText!)!;

    expect(textOf(applied.resume, "experience/exp-loudly/bullets/bul-1")).toBe(
      "Owned frontend performance across the playback surface.",
    );
    // Everything else is the document it was before, character for character.
    expect({ ...applied.resume, experience: null }).toEqual({ ...resume, experience: null });
    expect(applied.resume.experience[0]!.bullets[1]).toEqual(resume.experience[0]!.bullets[1]);
    expect(applied.resume.experience[1]).toEqual(resume.experience[1]);
  });

  it("leaves the document it was given untouched", () => {
    applySuggestion(resume, suggestion, "Owned frontend performance.");
    expect(resume.experience[0]!.bullets[0]!.text).toBe(
      "Worked on frontend performance across the playback surface.",
    );
  });

  it("records what was there before, and what replaced it", () => {
    const { change } = applySuggestion(resume, suggestion, suggestion.suggestedText!)!;

    expect(change.suggestionId).toBe("m-1");
    expect(change.targetId).toBe("experience/exp-loudly/bullets/bul-1");
    expect(change.previousValue).toBe(
      "Worked on frontend performance across the playback surface.",
    );
    expect(change.nextValue).toBe("Owned frontend performance across the playback surface.");
    expect(Date.parse(change.createdAt)).not.toBeNaN();
  });

  it("applies the person's own wording when they edited it first", () => {
    const edited = "Led the performance work on the playback surface.";
    const applied = applySuggestion(resume, suggestion, edited)!;

    expect(textOf(applied.resume, "experience/exp-loudly/bullets/bul-1")).toBe(edited);
    expect(applied.change.nextValue).toBe(edited);
  });

  it("refuses an address that no longer resolves", () => {
    expect(applySuggestion(resume, { ...suggestion, targetItemId: "bul-gone" }, "x")).toBeNull();
  });

  it("refuses to record a change that changes nothing", () => {
    expect(applySuggestion(resume, suggestion, suggestion.currentText!)).toBeNull();
  });
});

describe("undoing", () => {
  it("puts the previous value back", () => {
    const applied = applySuggestion(resume, suggestion, suggestion.suggestedText!)!;
    const reverted = revertChange(applied.resume, applied.change)!;

    expect(textOf(reverted, "experience/exp-loudly/bullets/bul-1")).toBe(
      "Worked on frontend performance across the playback surface.",
    );
    expect(reverted).toEqual(resume);
  });

  it("still restores after the field was edited again by hand", () => {
    const applied = applySuggestion(resume, suggestion, suggestion.suggestedText!)!;
    const element = resumeElements(applied.resume).find(
      (candidate) => candidate.key === applied.change.targetId,
    )!;
    const editedFurther = element.write("Something else entirely.");

    const reverted = revertChange(editedFurther, applied.change)!;
    expect(textOf(reverted, applied.change.targetId)).toBe(applied.change.previousValue);
  });

  it("refuses when the element is gone", () => {
    const applied = applySuggestion(resume, suggestion, suggestion.suggestedText!)!;
    const withoutEntry = { ...applied.resume, experience: applied.resume.experience.slice(1) };

    expect(revertChange(withoutEntry, applied.change)).toBeNull();
  });
});
