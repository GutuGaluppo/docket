import { describe, expect, it } from "vitest";

import { resumeElements } from "@/lib/resume/target";
import { SAMPLE_JOB, sampleResume } from "@/test/resume";

import { computeCoverage } from "./coverage";
import { readJobDescription } from "./heuristics";

const analysis = readJobDescription(SAMPLE_JOB);
const resume = sampleResume();

const statusOf = (requirementText: string) => {
  const requirement = [
    ...analysis.requiredSkills,
    ...analysis.preferredSkills,
    ...analysis.responsibilities,
    ...analysis.experienceRequirements,
  ].find((entry) => entry.text === requirementText);

  const { coverage } = computeCoverage(resume, analysis);
  return coverage.requirements.find((entry) => entry.requirementId === requirement?.id)?.status;
};

describe("what the CV answers", () => {
  it("calls a skill strong when the work history shows it", () => {
    // React is in a bullet under Loudly, not only in the skills list.
    expect(statusOf("React")).toBe("strong");
  });

  it("calls a skill partial when it is only claimed in a list", () => {
    // TypeScript is in the skills group and in no role.
    expect(statusOf("TypeScript")).toBe("partial");
  });

  it("calls a skill missing when the CV never mentions it", () => {
    expect(statusOf("GraphQL")).toBe("missing");
  });

  it("scores every dimension between 0 and 100", () => {
    const { jobMatch } = computeCoverage(resume, analysis);
    for (const value of Object.values(jobMatch)) {
      if (value === null) continue;
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
  });

  it("leaves a dimension unmeasured when the advert gave nothing to measure", () => {
    const empty = {
      ...analysis,
      keywords: [],
      roleTitle: "",
      inferredSeniority: "",
      domain: "",
      requiredSkills: [],
    };
    const { jobMatch } = computeCoverage(resume, empty);
    expect(jobMatch.keywordCoverage).toBeNull();
    expect(jobMatch.roleAlignment).toBeNull();
    expect(jobMatch.experienceRelevance).not.toBeNull();
  });
});

describe("the figure after an edit", () => {
  it("rises when a claimed skill becomes evidence in a role", () => {
    const before = computeCoverage(resume, analysis).jobMatch;

    const bullet = resumeElements(resume).find((element) => element.target.itemId === "bul-1")!;
    const edited = bullet.write(
      "Rebuilt the playback surface in TypeScript, cutting the time to first sound.",
    );

    const after = computeCoverage(edited, analysis).jobMatch;
    expect(after.skillsMatch!).toBeGreaterThan(before.skillsMatch!);
    expect(after.overallScore).toBeGreaterThan(before.overallScore);
  });

  it("does not move when the edit says nothing the advert asked about", () => {
    const before = computeCoverage(resume, analysis).jobMatch;

    const phone = resumeElements(resume).find((element) => element.target.fieldId === "phone")!;
    const after = computeCoverage(phone.write("+49 30 000000"), analysis).jobMatch;

    // Section 7: the score moves when the document moves, and not otherwise.
    expect(after).toEqual(before);
  });

  it("falls when evidence is removed", () => {
    const before = computeCoverage(resume, analysis).jobMatch;

    const bullet = resumeElements(resume).find((element) => element.target.itemId === "bul-2")!;
    const after = computeCoverage(bullet.write("Shipped things."), analysis).jobMatch;

    expect(after.overallScore).toBeLessThan(before.overallScore);
  });
});
