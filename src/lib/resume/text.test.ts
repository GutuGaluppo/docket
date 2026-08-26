import { describe, expect, it } from "vitest";

import { blankResume } from "./schema";
import { resumeText, hasResumeContent } from "./text";
import { sampleResume } from "@/test/resume";

/**
 * Two things hang off "is there anything in this document": whether a reading
 * may be started at all, and whether the paste screen is still offered as a way
 * back out of an empty editor. Both would be wrong in a way nobody would notice
 * quickly, so the threshold is held here.
 */
describe("whether a document holds anything", () => {
  it("says no to one that was just created", () => {
    expect(hasResumeContent(blankResume())).toBe(false);
  });

  it("says no to a name and half a job title", () => {
    const started = blankResume();
    started.personal.fullName = "Ana Ribeiro";
    started.personal.headline = "Frontend";
    expect(hasResumeContent(started)).toBe(false);
  });

  it("says yes to a written CV", () => {
    expect(hasResumeContent(sampleResume())).toBe(true);
  });
});

describe("the document as text", () => {
  it("keeps each area apart, so a claim can be told from evidence", () => {
    const text = resumeText(sampleResume());

    expect(text.headline).toContain("Frontend Engineer");
    expect(text.skills).toContain("TypeScript");
    expect(text.experience).toContain("playback surface");
    // TypeScript is listed and never shown — the difference the scorer reads.
    expect(text.experience).not.toContain("TypeScript");
    expect(text.all).toContain("TypeScript");
  });

  it("leaves nothing behind for an empty document", () => {
    expect(resumeText(blankResume()).all).toBe("");
  });
});
