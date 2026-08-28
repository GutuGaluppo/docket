import { beforeAll, describe, expect, it } from "vitest";

import { blankResume } from "@/lib/resume/schema";
import type { ModelReading } from "@/lib/tailoring/schema";
import { BENCHMARK_JOB, nearPerfectResume } from "@/test/benchmark";
import { SAMPLE_JOB, sampleResume } from "@/test/resume";

import { adoptReading, analyze, mergeSuggestions } from "./analyze";
import type { ResumeSuggestion } from "@/lib/tailoring/types";

/**
 * The orchestration, exercised the way most deployments will run it: with no
 * key configured, so the reading is the deterministic one. That path is not a
 * degraded mode to be tolerated — it is the product minus the rewrites, and it
 * has to produce a whole reading with a figure that can be taken apart.
 */
beforeAll(() => {
  delete process.env.AI_API_KEY;
  delete process.env.OPENAI_API_KEY;
});

describe("a reading with no model configured", () => {
  it("produces a figure, requirements, verdicts and an explanation", async () => {
    const result = await analyze({ resume: sampleResume(), jobDescription: SAMPLE_JOB });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.analysis.source).toBe("heuristic");
    expect(result.analysis.degraded).toBeUndefined();
    expect(result.analysis.jobMatch.overallScore).toBeGreaterThan(0);
    expect(result.analysis.jobAnalysis.requirements.length).toBeGreaterThan(0);
    expect(result.analysis.coverage.requirements.length).toBe(
      result.analysis.jobAnalysis.requirements.length,
    );
    expect(result.analysis.explanation.dimensions).toHaveLength(4);
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

  it("says the same thing in the figure and in the advice", async () => {
    // Section 66: a Skills Match of 95% beside "you are missing every core
    // skill" is not a wording problem, it is two analyses on one screen.
    const result = await analyze({
      resume: nearPerfectResume(),
      jobDescription: BENCHMARK_JOB,
    });
    if (!result.ok) throw new Error("expected a reading");

    const missing = new Set(
      result.analysis.coverage.requirements
        .filter((entry) => entry.match === "missing")
        .map((entry) => entry.requirementId),
    );

    for (const suggestion of result.analysis.suggestions) {
      if (suggestion.type !== "missing_requirement" || !suggestion.requirementId) continue;
      expect(missing.has(suggestion.requirementId)).toBe(true);
    }
  });

  it("puts what the advert insists on at the top", async () => {
    const result = await analyze({ resume: sampleResume(), jobDescription: SAMPLE_JOB });
    if (!result.ok) throw new Error("expected a reading");

    expect(result.analysis.suggestions[0]!.priority).toBe("high");
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

describe("reporting where a reading has got to", () => {
  it("passes each stage once, in order", async () => {
    const seen: string[] = [];
    await analyze({
      resume: sampleResume(),
      jobDescription: SAMPLE_JOB,
      onStep: (step) => {
        seen.push(step);
      },
    });

    expect(seen).toEqual(["resume", "job", "compare", "score", "suggestions"]);
  });

  it("reports nothing for a reading it refuses to start", async () => {
    const seen: string[] = [];
    await analyze({
      resume: blankResume(),
      jobDescription: SAMPLE_JOB,
      onStep: (step) => {
        seen.push(step);
      },
    });

    expect(seen).toEqual([]);
  });

  it("stops when the reading is cancelled, without writing anything", async () => {
    const controller = new AbortController();
    const seen: string[] = [];

    controller.abort();
    const result = await analyze({
      resume: sampleResume(),
      jobDescription: SAMPLE_JOB,
      signal: controller.signal,
      onStep: (step) => {
        seen.push(step);
      },
    });

    expect(result).toEqual({ ok: false, reason: "cancelled" });
    expect(seen).toEqual(["resume", "job"]);
  });
});

describe("taking a model's reading in", () => {
  const reading: ModelReading = {
    jobAnalysis: {
      roleTitle: "Senior Frontend Engineer",
      requirements: [
        {
          id: "model-a",
          name: "React",
          category: "skill",
          importance: "required",
          aliases: ["react.js"],
          sourceText: "Strong React experience",
        },
        {
          id: "model-b",
          name: "Observability",
          category: "practice",
          importance: "preferred",
          aliases: ["monitoring"],
          sourceText: "Added bonus: Grafana",
        },
      ],
      keywords: [{ text: "react", weight: "primary", occurrences: 4, aliases: [] }],
      inferredSeniority: "senior",
      domain: "fintech",
    },
    matches: [
      {
        requirementId: "model-a",
        match: "strong",
        confidence: 0.95,
        evidence: [{ source: "experience", text: "Built the subscription flow in React" }],
        reasoning: "Named in a role.",
      },
      {
        requirementId: "unknown-id",
        match: "strong",
        confidence: 0.9,
        evidence: [],
      },
    ],
    suggestions: [],
  };

  it("gives every requirement an id of this application's own", () => {
    const { jobAnalysis } = adoptReading(reading);

    expect(jobAnalysis.requirements.map((requirement) => requirement.id)).toEqual([
      "req-0",
      "req-1",
    ]);
    expect(jobAnalysis.requirements[0]!.name).toBe("React");
  });

  it("re-keys the verdicts onto them", () => {
    const { verdicts } = adoptReading(reading);

    expect(verdicts).toHaveLength(1);
    expect(verdicts[0]).toMatchObject({ requirementId: "req-0", match: "strong" });
  });

  it("drops a verdict about a requirement that does not exist", () => {
    const { verdicts } = adoptReading(reading);
    expect(verdicts.some((verdict) => verdict.requirementId === "unknown-id")).toBe(false);
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
      [suggestion({ id: "m-1", source: "model", requirementId: "req-3" })],
      [suggestion({ id: "h-1", requirementId: "req-3" })],
    );

    expect(merged.map((entry) => entry.id)).toEqual(["m-1"]);
  });

  it("adds the gaps the model did not mention", () => {
    const merged = mergeSuggestions(
      [suggestion({ id: "m-1", source: "model", requirementId: "req-3" })],
      [suggestion({ id: "h-1", requirementId: "req-9", targetFieldId: "other" })],
    );

    expect(merged.map((entry) => entry.id)).toEqual(["m-1", "h-1"]);
  });
});
