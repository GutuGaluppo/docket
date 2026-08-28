import { describe, expect, it } from "vitest";

import { JOB_MATCH_WEIGHTS, matchLabel, overallScore, scoreDelta, toJobMatch } from "./score";

describe("the overall score", () => {
  it("is the weighted average of the four dimensions", () => {
    const score = overallScore({
      skillsMatch: 82,
      experienceRelevance: 76,
      keywordCoverage: 68,
      roleAlignment: 73,
    });

    // 82·0.30 + 76·0.30 + 68·0.20 + 73·0.20 = 75.6
    expect(score).toBe(76);
  });

  it("weights skills and experience above keywords and role", () => {
    expect(JOB_MATCH_WEIGHTS.skillsMatch + JOB_MATCH_WEIGHTS.experienceRelevance).toBeCloseTo(0.6);
    // The table is checked at load as well; this is the same claim, said where
    // somebody changing the numbers will read it.
    expect(
      Object.values(JOB_MATCH_WEIGHTS).reduce((total, weight) => total + weight, 0),
    ).toBeCloseTo(1);
  });

  it("stays inside 0–100 whatever it is handed", () => {
    expect(overallScore({ skillsMatch: 400, experienceRelevance: 400 })).toBe(100);
    expect(overallScore({ skillsMatch: -50 })).toBe(0);
    expect(overallScore({ skillsMatch: Number.NaN })).toBe(0);
  });

  it("redistributes the weight of a dimension the advert cannot measure", () => {
    // No keywords and no role title: the figure is the average of what is left,
    // not a score punished for the advert's silence.
    const partial = overallScore({ skillsMatch: 80, experienceRelevance: 60 });
    expect(partial).toBe(70);

    // Scoring the absent dimensions as zero would have given 42.
    expect(
      overallScore({
        skillsMatch: 80,
        experienceRelevance: 60,
        keywordCoverage: 0,
        roleAlignment: 0,
      }),
    ).toBe(42);
  });

  it("returns zero when nothing at all could be measured", () => {
    expect(overallScore({})).toBe(0);
    expect(toJobMatch({}).skillsMatch).toBeNull();
  });

  it("keeps an unmeasurable dimension null rather than zero", () => {
    const match = toJobMatch({ skillsMatch: 82, keywordCoverage: null });
    expect(match.skillsMatch).toBe(82);
    expect(match.keywordCoverage).toBeNull();
    expect(match.overallScore).toBe(82);
  });
});

describe("the band a score falls in", () => {
  it("names the four bands at their edges", () => {
    expect(matchLabel(0)).toBe("Low alignment");
    expect(matchLabel(39)).toBe("Low alignment");
    expect(matchLabel(40)).toBe("Moderate alignment");
    expect(matchLabel(59)).toBe("Moderate alignment");
    expect(matchLabel(60)).toBe("Strong alignment");
    expect(matchLabel(79)).toBe("Strong alignment");
    expect(matchLabel(80)).toBe("Excellent alignment");
    expect(matchLabel(100)).toBe("Excellent alignment");
  });

  it("has a band for every score, however it arrived", () => {
    for (let score = -20; score <= 120; score += 1) {
      expect(matchLabel(score)).toBeTruthy();
    }
  });
});

describe("the difference the last change made", () => {
  it("is the movement of the overall figure", () => {
    const before = toJobMatch({ skillsMatch: 70 });
    const after = toJobMatch({ skillsMatch: 76 });
    expect(scoreDelta(before, after)).toBe(6);
  });

  it("is zero when there is nothing to compare", () => {
    expect(scoreDelta(null, toJobMatch({ skillsMatch: 70 }))).toBe(0);
  });
});
