import { describe, expect, it } from "vitest";

import { resumeElements } from "@/lib/resume/target";
import { SAMPLE_JOB, sampleResume } from "@/test/resume";

import { applySuggestion, revertChange } from "./apply";
import { computeCoverage } from "./matching";
import { gapSuggestions } from "./gaps";
import { readJobDescription } from "./heuristics";
import { initialState, tailoringReducer, type TailoringState } from "./state";
import type { TailoringAnalysis } from "./types";

/**
 * The interaction rules, tested where they live.
 *
 * Hover, selection and scrolling are decisions, not rendering: which element a
 * card points at, whether the highlight survives the pointer leaving, whether a
 * second click scrolls again. Keeping them in the reducer is what makes them
 * checkable without a browser, and it is also why the components below them can
 * stay as thin as they are.
 */
function build(): { state: TailoringState; analysis: TailoringAnalysis } {
  const resume = sampleResume();
  const jobAnalysis = readJobDescription(SAMPLE_JOB);
  const { jobMatch, coverage, explanation } = computeCoverage(resume, jobAnalysis);

  const analysis: TailoringAnalysis = {
    jobAnalysis,
    coverage,
    jobMatch,
    explanation,
    suggestions: gapSuggestions({ resume, analysis: jobAnalysis, coverage }),
    source: "heuristic",
    analyzedAt: new Date("2026-08-26T10:00:00.000Z").toISOString(),
  };

  const state = tailoringReducer(initialState({ resume, jobDescription: SAMPLE_JOB }), {
    type: "analyzed",
    analysis,
  });

  return { state, analysis };
}

const bulletSuggestion = (state: TailoringState) =>
  state.suggestions.find((suggestion) => suggestion.targetItemId)!;

describe("hovering a recommendation", () => {
  it("highlights the element it points at", () => {
    const { state } = build();
    const suggestion = bulletSuggestion(state);

    const hovered = tailoringReducer(state, { type: "hover", suggestionId: suggestion.id });
    expect(hovered.highlightedElementKey).toBe(
      `experience/${suggestion.targetEntryId}/bullets/${suggestion.targetItemId}`,
    );
  });

  it("drops the highlight when the pointer leaves", () => {
    const { state } = build();
    const hovered = tailoringReducer(state, {
      type: "hover",
      suggestionId: bulletSuggestion(state).id,
    });

    expect(
      tailoringReducer(hovered, { type: "hover", suggestionId: null }).highlightedElementKey,
    ).toBeNull();
  });

  it("never asks the editor to scroll", () => {
    const { state } = build();
    const hovered = tailoringReducer(state, {
      type: "hover",
      suggestionId: bulletSuggestion(state).id,
    });

    expect(hovered.scrollRequest).toBeNull();
  });

  it("highlights nothing for a card whose target has gone", () => {
    const { state } = build();
    const orphaned: TailoringState = {
      ...state,
      suggestions: [{ ...bulletSuggestion(state), id: "ghost", targetItemId: "bul-gone" }],
    };

    expect(
      tailoringReducer(orphaned, { type: "hover", suggestionId: "ghost" }).highlightedElementKey,
    ).toBeNull();
  });
});

describe("clicking a recommendation", () => {
  it("selects the element and asks for a scroll", () => {
    const { state } = build();
    const suggestion = bulletSuggestion(state);

    const active = tailoringReducer(state, { type: "activate", suggestionId: suggestion.id });
    expect(active.activeSuggestionId).toBe(suggestion.id);
    expect(active.selectedElementKey).toBe(
      `experience/${suggestion.targetEntryId}/bullets/${suggestion.targetItemId}`,
    );
    expect(active.scrollRequest?.key).toBe(active.selectedElementKey);
  });

  it("keeps the selection when the pointer moves away", () => {
    const { state } = build();
    const suggestion = bulletSuggestion(state);

    const active = tailoringReducer(state, { type: "activate", suggestionId: suggestion.id });
    const afterHover = tailoringReducer(active, { type: "hover", suggestionId: null });

    expect(afterHover.selectedElementKey).toBe(active.selectedElementKey);
    expect(afterHover.highlightedElementKey).toBeNull();
  });

  it("scrolls again when the same card is clicked twice", () => {
    const { state } = build();
    const suggestion = bulletSuggestion(state);

    const once = tailoringReducer(state, { type: "activate", suggestionId: suggestion.id });
    const twice = tailoringReducer(once, { type: "activate", suggestionId: suggestion.id });

    expect(twice.scrollRequest?.nonce).toBe(once.scrollRequest!.nonce + 1);
  });
});

describe("the document changing", () => {
  it("rescores a hand edit against the stored reading instead of going stale", () => {
    const { state } = build();
    const element = resumeElements(state.resume).find((entry) => entry.target.itemId === "bul-1")!;
    const next = element.write("Led the performance work on the playback surface.");

    const edited = tailoringReducer(state, { type: "resume-edited", resume: next });

    expect(edited.status).toBe("ready");
    // The same arithmetic Apply runs on the server, so the two cannot disagree.
    expect(edited.jobMatch).toEqual(computeCoverage(next, state.analysis!.jobAnalysis).jobMatch);
    // The recommendations are the reading's, and a keystroke does not rewrite them.
    expect(edited.analysis?.suggestions).toBe(state.analysis?.suggestions);
    // The panel keeps saying what the document now says, not what it said.
    expect(
      edited.suggestions.find((suggestion) => suggestion.targetItemId === "bul-1")?.currentText,
    ).toBe("Led the performance work on the playback surface.");
  });

  it("moves the figure up when a missing term is typed in", () => {
    const { state } = build();
    const before = state.jobMatch!.overallScore;
    const withGraphQL = {
      ...state.resume,
      skills: state.resume.skills.map((group, index) =>
        index === 0 ? { ...group, skills: [...group.skills, "GraphQL"] } : group,
      ),
    };

    const edited = tailoringReducer(state, { type: "resume-edited", resume: withGraphQL });
    expect(edited.jobMatch!.overallScore).toBeGreaterThan(before);
    expect(edited.lastDelta).toBe(edited.jobMatch!.overallScore - before);
  });

  it("goes stale instead when the advert changed after the reading", () => {
    const { state } = build();
    const otherAdvert = tailoringReducer(state, {
      type: "job-description",
      applicationId: null,
      text: "A different advert entirely.",
    });
    const edited = tailoringReducer(otherAdvert, {
      type: "resume-edited",
      resume: otherAdvert.resume,
    });

    expect(edited.status).toBe("stale");
    expect(edited.jobMatch).toEqual(state.jobMatch);
  });

  it("does not go stale before there is a reading to invalidate", () => {
    const idle = initialState({ resume: sampleResume() });
    const edited = tailoringReducer(idle, { type: "resume-edited", resume: sampleResume() });
    expect(edited.status).toBe("idle");
  });
});

describe("applying, dismissing and undoing", () => {
  it("records the change, marks the card applied and moves the figure", () => {
    const { state, analysis } = build();
    const suggestion = state.suggestions.find((entry) => entry.targetItemId === "bul-1")!;

    const applied = applySuggestion(
      state.resume,
      suggestion,
      "Owned frontend performance in TypeScript across the playback surface.",
    )!;
    const jobMatch = computeCoverage(applied.resume, analysis.jobAnalysis).jobMatch;

    const next = tailoringReducer(state, {
      type: "applied",
      resume: applied.resume,
      change: applied.change,
      jobMatch,
      status: "applied",
    });

    expect(next.suggestions.find((entry) => entry.id === suggestion.id)?.status).toBe("applied");
    expect(next.history[0]).toEqual(applied.change);
    expect(next.status).toBe("ready");
    expect(next.lastDelta).toBe(jobMatch.overallScore - state.jobMatch!.overallScore);
    expect(next.lastDelta).toBeGreaterThan(0);
  });

  it("leaves the document and the figure alone when a card is dismissed", () => {
    const { state } = build();
    const suggestion = state.suggestions[0]!;

    const next = tailoringReducer(state, { type: "dismissed", suggestionId: suggestion.id });

    expect(next.resume).toEqual(state.resume);
    expect(next.jobMatch).toEqual(state.jobMatch);
    expect(next.history).toEqual(state.history);
    expect(next.suggestions.find((entry) => entry.id === suggestion.id)?.status).toBe("dismissed");
  });

  it("restores the value and puts the card back in the queue", () => {
    const { state, analysis } = build();
    const suggestion = state.suggestions.find((entry) => entry.targetItemId === "bul-1")!;

    const applied = applySuggestion(state.resume, suggestion, "Owned frontend performance.")!;
    const withChange = tailoringReducer(state, {
      type: "applied",
      resume: applied.resume,
      change: applied.change,
      jobMatch: computeCoverage(applied.resume, analysis.jobAnalysis).jobMatch,
      status: "applied",
    });

    const reverted = revertChange(withChange.resume, applied.change)!;
    const undone = tailoringReducer(withChange, {
      type: "undone",
      resume: reverted,
      changeId: applied.change.id,
      jobMatch: computeCoverage(reverted, analysis.jobAnalysis).jobMatch,
    });

    expect(undone.resume).toEqual(state.resume);
    expect(undone.history).toHaveLength(0);
    expect(undone.suggestions.find((entry) => entry.id === suggestion.id)?.status).toBe("pending");
    expect(undone.jobMatch).toEqual(state.jobMatch);
  });
});

describe("while a reading runs", () => {
  it("starts the checklist with nothing done", () => {
    const { state } = build();
    const analyzing = tailoringReducer(state, { type: "analyzing" });

    expect(analyzing.status).toBe("analyzing");
    expect(analyzing.steps.every((step) => step.status === "pending")).toBe(true);
  });

  it("advances only on what the server reports", () => {
    const { state } = build();
    const analyzing = tailoringReducer(state, { type: "analyzing" });
    const moved = tailoringReducer(analyzing, {
      type: "step",
      event: { step: "compare", status: "active" },
    });

    expect(moved.steps.map((step) => step.status)).toEqual([
      "completed",
      "completed",
      "active",
      "pending",
      "pending",
    ]);
  });

  it("finishes the checklist when the result lands", () => {
    const { state, analysis } = build();
    const analyzing = tailoringReducer(state, { type: "analyzing" });
    const done = tailoringReducer(analyzing, { type: "analyzed", analysis });

    expect(done.steps.every((step) => step.status === "completed")).toBe(true);
  });

  it("keeps the previous result when a reading is cancelled", () => {
    const { state } = build();
    const analyzing = tailoringReducer(state, { type: "analyzing" });
    const cancelled = tailoringReducer(analyzing, { type: "cancelled" });

    expect(cancelled.status).toBe("ready");
    expect(cancelled.jobMatch).toEqual(state.jobMatch);
    expect(cancelled.suggestions).toEqual(state.suggestions);
    expect(cancelled.error).toBe("");
  });

  it("goes back to idle when a first reading is cancelled", () => {
    const idle = initialState({ resume: sampleResume(), jobDescription: SAMPLE_JOB });
    const cancelled = tailoringReducer(tailoringReducer(idle, { type: "analyzing" }), {
      type: "cancelled",
    });

    expect(cancelled.status).toBe("idle");
  });
});

describe("a failed reading", () => {
  it("keeps every change the person made", () => {
    const { state } = build();
    const analyzing = tailoringReducer(state, { type: "analyzing" });
    const failed = tailoringReducer(analyzing, { type: "failed", error: "The reading failed." });

    expect(failed.status).toBe("error");
    expect(failed.resume).toEqual(state.resume);
    expect(failed.suggestions).toEqual(state.suggestions);
  });

  it("keeps the figure it already had", () => {
    // Section 38: a failed retry does not destroy a result that was valid.
    const { state } = build();
    const failed = tailoringReducer(tailoringReducer(state, { type: "analyzing" }), {
      type: "failed",
      error: "The reading failed.",
    });

    expect(failed.jobMatch).toEqual(state.jobMatch);
    expect(failed.analysis).toEqual(state.analysis);
  });

  it("marks the checklist where it stopped rather than resetting it", () => {
    const { state } = build();
    const running = tailoringReducer(tailoringReducer(state, { type: "analyzing" }), {
      type: "step",
      event: { step: "compare", status: "active" },
    });
    const failed = tailoringReducer(running, { type: "failed", error: "It stopped." });

    expect(failed.steps.map((step) => step.status)).toEqual([
      "completed",
      "completed",
      "error",
      "pending",
      "pending",
    ]);
  });
});
