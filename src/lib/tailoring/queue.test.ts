import { describe, expect, it } from "vitest";

import { groupSuggestions, isAcceptable } from "./queue";
import type { ResumeSuggestion } from "./types";

const card = (id: string, extra: Partial<ResumeSuggestion>): ResumeSuggestion => ({
  id,
  targetSectionId: "experience",
  type: "weak_wording",
  priority: "medium",
  title: id,
  reason: "",
  affects: [],
  requiresConfirmation: false,
  source: "heuristic",
  status: "pending",
  ...extra,
});

const sorted = [
  card("a", { targetSectionId: "summary", priority: "low" }),
  card("b", { targetSectionId: "experience", priority: "high" }),
  card("c", { targetSectionId: "summary", priority: "high" }),
  card("d", { targetSectionId: "skills", status: "applied" }),
];

const label = (suggestion: ResumeSuggestion) => suggestion.targetSectionId;

describe("grouping recommendations", () => {
  it("groups by section in the order the sorted list meets them", () => {
    const { groups, settled } = groupSuggestions(sorted, "section", label);
    expect(groups.map((group) => [group.id, group.items.map((item) => item.id)])).toEqual([
      ["summary", ["a", "c"]],
      ["experience", ["b"]],
    ]);
    expect(settled.map((item) => item.id)).toEqual(["d"]);
  });

  it("groups by priority, most important first", () => {
    const { groups } = groupSuggestions(sorted, "priority", label);
    expect(groups.map((group) => group.label)).toEqual(["High priority", "Low priority"]);
    expect(groups[0]?.items.map((item) => item.id)).toEqual(["b", "c"]);
  });
});

describe("what can be accepted without writing anything", () => {
  it("needs pending status and a suggested text", () => {
    expect(isAcceptable(card("x", { suggestedText: "Better." }))).toBe(true);
    expect(isAcceptable(card("x", {}))).toBe(false);
    expect(isAcceptable(card("x", { suggestedText: "Better.", status: "dismissed" }))).toBe(false);
  });
});
