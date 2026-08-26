import { beforeAll, describe, expect, it } from "vitest";

import { blankResume } from "@/lib/resume/schema";
import type { ResumeSuggestion } from "@/lib/tailoring/types";
import { SAMPLE_JOB, sampleResume } from "@/test/resume";

import { analyze, mergeAnalysis, mergeSuggestions } from "./analyze";

// No key, whatever the machine running the suite happens to export. A test that
// reaches a model is a test that fails on someone else's laptop and bills for it.
beforeAll(() => {
  delete process.env.AI_API_KEY;
  delete process.env.OPENAI_API_KEY;
});

/**
 * The orchestration, exercised the way most deployments will run it: with no
 * key configured. That path is not a degraded mode to be tolerated — it is the
 * product minus the rewrites, and it has to produce a whole reading.
 */
describe("a reading with no model configured", () => {
  it("still produces a figure, a job analysis and recommendations", async () => {
    const result = await analyze({ resume: sampleResume(), jobDescription: SAMPLE_JOB });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.analysis.source).toBe("heuristic");
    expect(result.analysis.degraded).toBeUndefined();
    expect(result.analysis.jobMatch.overallScore).toBeGreaterThan(0);
    expect(result.analysis.jobAnalysis.requiredSkills.length).toBeGreaterThan(0);
    expect(result.analysis.suggestions.length).toBeGreaterThan(0);
    expect(Date.parse(result.analysis.analyzedAt)).not.toBeNaN();
  });

  it("never proposes text for something the CV cannot support", async () => {
    const result = await analyze({ resume: sampleResume(), jobDescription: SAMPLE_JOB });
    if (!result.ok) throw new Error("expected a reading");

    const gaps = result.analysis.suggestions.filter(
      (suggestion) => suggestion.type === "missing_requirement",
    );

    expect(gaps.length).toBeGreaterThan(0);
    for (const gap of gaps) {
      expect(gap.suggestedText).toBeUndefined();
      expect(gap.requiresConfirmation).toBe(true);
    }
  });

  it("puts what the advert insists on at the top", async () => {
    const result = await analyze({ resume: sampleResume(), jobDescription: SAMPLE_JOB });
    if (!result.ok) throw new Error("expected a reading");

    expect(result.analysis.suggestions[0]!.priority).toBe("high");
  });

  it("points every recommendation at an element that exists", async () => {
    const result = await analyze({ resume: sampleResume(), jobDescription: SAMPLE_JOB });
    if (!result.ok) throw new Error("expected a reading");

    const resume = sampleResume();
    for (const suggestion of result.analysis.suggestions) {
      if (!suggestion.targetItemId) continue;
      const found = resume.experience
        .flatMap((entry) => entry.bullets)
        .some((bullet) => bullet.id === suggestion.targetItemId);
      expect(found, `${suggestion.id} points at ${suggestion.targetItemId}`).toBe(true);
    }
  });
});

describe("what cannot be read", () => {
  it("refuses an empty CV", async () => {
    const result = await analyze({ resume: blankResume(), jobDescription: SAMPLE_JOB });
    expect(result).toEqual({ ok: false, reason: "empty-resume" });
  });

  it("refuses three lines of advert", async () => {
    const result = await analyze({
      resume: sampleResume(),
      jobDescription: "Frontend developer wanted. Apply within.",
    });
    expect(result).toEqual({ ok: false, reason: "empty-job" });
  });
});

describe("merging the two readings", () => {
  const base = {
    roleTitle: "Frontend Engineer",
    requiredSkills: [
      {
        id: "skill-0",
        text: "React",
        importance: "required" as const,
        kind: "skill" as const,
        terms: ["React"],
      },
    ],
    preferredSkills: [],
    responsibilities: [],
    experienceRequirements: [],
    keywords: [{ id: "kw-0", text: "frontend", weight: "primary" as const, occurrences: 4 }],
    inferredSeniority: "senior",
    domain: "music",
  };

  it("prefers the model's list where it produced one", () => {
    const merged = mergeAnalysis(base, {
      roleTitle: "Senior Frontend Engineer",
      requiredSkills: [
        { text: "TypeScript", importance: "required", kind: "skill", terms: ["TS"] },
      ],
      preferredSkills: [],
      responsibilities: [],
      experienceRequirements: [],
      keywords: [],
      inferredSeniority: "",
      domain: "",
    });

    expect(merged.roleTitle).toBe("Senior Frontend Engineer");
    expect(merged.requiredSkills.map((skill) => skill.text)).toEqual(["TypeScript"]);
    // Lists the model left empty keep the reading the advert's own words gave.
    expect(merged.keywords).toEqual(base.keywords);
    expect(merged.inferredSeniority).toBe("senior");
    expect(merged.domain).toBe("music");
  });

  it("gives every merged requirement an id of its own", () => {
    const merged = mergeAnalysis(base, {
      roleTitle: "",
      requiredSkills: [
        { text: "React", importance: "required", kind: "skill", terms: [] },
        { text: "TypeScript", importance: "required", kind: "skill", terms: [] },
      ],
      preferredSkills: [],
      responsibilities: [],
      experienceRequirements: [],
      keywords: [],
      inferredSeniority: "",
      domain: "",
    });

    const ids = merged.requiredSkills.map((skill) => skill.id);
    expect(new Set(ids).size).toBe(ids.length);
    // A requirement with no spellings of its own still has one: its own name.
    expect(merged.requiredSkills[0]!.terms).toEqual(["React"]);
  });
});

describe("merging the two lists of recommendations", () => {
  const suggestion = (overrides: Partial<ResumeSuggestion>): ResumeSuggestion => ({
    id: "x",
    targetSectionId: "skills",
    targetEntryId: "skl-front",
    type: "missing_requirement",
    priority: "high",
    title: "GraphQL is asked for",
    reason: "…",
    affects: [],
    requiresConfirmation: true,
    source: "heuristic",
    status: "pending",
    ...overrides,
  });

  it("keeps the model's version of a gap it already reported", () => {
    const merged = mergeSuggestions(
      [suggestion({ id: "m-1", source: "model", relatedKeywords: ["GraphQL"] })],
      [suggestion({ id: "h-1", relatedKeywords: ["GraphQL"] })],
    );

    expect(merged.map((entry) => entry.id)).toEqual(["m-1"]);
  });

  it("adds the gaps the model did not mention", () => {
    const merged = mergeSuggestions(
      [suggestion({ id: "m-1", source: "model", relatedKeywords: ["GraphQL"] })],
      [suggestion({ id: "h-1", relatedKeywords: ["Kubernetes"], targetFieldId: "other" })],
    );

    expect(merged.map((entry) => entry.id)).toEqual(["m-1", "h-1"]);
  });
});
