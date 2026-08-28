import { describe, expect, it } from "vitest";

import { resumeElements } from "@/lib/resume/target";
import {
  BENCHMARK_JOB,
  echoResume,
  nearPerfectResume,
  partialResume,
  poorResume,
} from "@/test/benchmark";

import { readJobDescription } from "./heuristics";
import { computeCoverage } from "./matching";
import type { Resume } from "@/lib/resume/schema";

/**
 * The benchmark, and the properties that matter more than any single number.
 *
 * These bands exist to catch regressions, not to be the product's opinion of a
 * candidate. What is actually being asserted is that the scorer measures fit:
 * that a CV covering the role scores like one, that a CV in another profession
 * does not, and — the one that started this — that saying the same thing in
 * your own words is worth as much as repeating the advert's.
 */
const analysis = readJobDescription(BENCHMARK_JOB);
const score = (resume: Resume) => computeCoverage(resume, analysis).jobMatch.overallScore;

describe("the benchmark", () => {
  it("scores a CV that covers the role like one", () => {
    const figure = score(nearPerfectResume());

    expect(figure).toBeGreaterThanOrEqual(85);
    expect(figure).toBeLessThanOrEqual(100);
  });

  it("scores a CV that covers half of it in the middle", () => {
    const figure = score(partialResume());

    expect(figure).toBeGreaterThan(25);
    expect(figure).toBeLessThan(70);
  });

  it("scores a CV from another profession near the floor", () => {
    expect(score(poorResume())).toBeLessThan(20);
  });

  it("keeps the three of them in order, with room between them", () => {
    const near = score(nearPerfectResume());
    const some = score(partialResume());
    const none = score(poorResume());

    expect(near).toBeGreaterThan(some + 30);
    expect(some).toBeGreaterThan(none + 20);
  });

  /**
   * The regression that started the refactor: a CV written in a person's own
   * words scored 65 while the same CV with the advert's sentences pasted into
   * it scored 92. Paraphrase is what a real CV is written in.
   */
  it("pays no premium for repeating the advert's own words", () => {
    const written = score(nearPerfectResume());
    const echoed = score(echoResume());

    expect(Math.abs(echoed - written)).toBeLessThanOrEqual(5);
  });

  it("explains every dimension it reports", () => {
    const { explanation, jobMatch } = computeCoverage(nearPerfectResume(), analysis);

    for (const dimension of explanation.dimensions) {
      expect(jobMatch[dimension.dimension]).toBe(dimension.score);
      if (dimension.score !== null) expect(dimension.possible).toBeGreaterThan(0);
    }

    expect(explanation.strong.length).toBeGreaterThan(10);
    expect(explanation.warnings).toEqual([]);
  });

  it("names what is missing, and the naming agrees with the arithmetic", () => {
    const { explanation, coverage } = computeCoverage(partialResume(), analysis);

    const missing = coverage.requirements.filter((entry) => entry.match === "missing");
    expect(explanation.missing).toHaveLength(missing.length);
    expect(explanation.missing).toContain("GraphQL");
  });

  it("attaches evidence to everything it counts as met", () => {
    const { coverage } = computeCoverage(nearPerfectResume(), analysis);

    for (const verdict of coverage.requirements) {
      if (verdict.match === "missing") {
        expect(verdict.evidence).toEqual([]);
        continue;
      }
      expect(verdict.evidence.length).toBeGreaterThan(0);
      expect(verdict.evidence[0]!.text.length).toBeGreaterThan(0);
    }
  });
});

/* -------------------------------------------------------------------------- */

/** Adds a bullet to the first role, which is how a CV gains evidence. */
function withBullet(resume: Resume, text: string): Resume {
  return {
    ...resume,
    experience: resume.experience.map((entry, index) =>
      index === 0
        ? { ...entry, bullets: [...entry.bullets, { id: `bul-x${index}`, text }] }
        : entry,
    ),
  };
}

function withoutTerm(resume: Resume, term: string): Resume {
  const strip = (text: string) => text.replace(new RegExp(term, "gi"), "");

  return {
    ...resume,
    summary: { text: strip(resume.summary.text) },
    experience: resume.experience.map((entry) => ({
      ...entry,
      bullets: entry.bullets.map((bullet) => ({ ...bullet, text: strip(bullet.text) })),
    })),
    skills: resume.skills.map((group) => ({
      ...group,
      skills: group.skills.filter((skill) => !new RegExp(term, "i").test(skill)),
    })),
  };
}

describe("the properties a score has to have", () => {
  it("never falls when a CV gains relevant evidence", () => {
    const before = partialResume();
    const after = withBullet(
      before,
      "Consumed the platform's GraphQL API from the booking product and kept the schema in step with the backend team.",
    );

    expect(score(after)).toBeGreaterThanOrEqual(score(before));
  });

  it("moves more for something required than for something preferred", () => {
    const base = partialResume();

    // Observability sits under "Added bonus"; React is asked for outright.
    const withBonus = withBullet(
      base,
      "Watched the dashboards and traces in Grafana and Honeycomb after every release.",
    );
    const withRequired = withBullet(
      base,
      "Owned technical SEO: crawlability, structured data and Core Web Vitals across the site.",
    );

    const bonusGain = score(withBonus) - score(base);
    const requiredGain = score(withRequired) - score(base);

    expect(bonusGain).toBeGreaterThan(0);
    expect(requiredGain).toBeGreaterThan(bonusGain);
  });

  it("keeps the value of one optional requirement proportionate", () => {
    // An advert asking for twenty-five things does not let any one of them
    // decide the answer: having or not having one optional tool is worth a
    // point or two, not a grade.
    const base = partialResume();
    const withBonus = withBullet(
      base,
      "Watched the dashboards and traces in Grafana and Honeycomb after every release.",
    );

    const gain = score(withBonus) - score(base);
    expect(gain).toBeGreaterThan(0);
    expect(gain).toBeLessThanOrEqual(6);
  });

  it("does not lose a capability because the CV stopped naming the tool", () => {
    // The candidate still watches dashboards and traces; only the brand names
    // are gone. A scorer that reads tools rather than work would call this a
    // loss, which is the lexical failure this refactor exists to remove.
    const complete = nearPerfectResume();
    const withoutBrands = withoutTerm(withoutTerm(complete, "Grafana"), "Honeycomb");

    expect(score(withoutBrands)).toBe(score(complete));
  });

  it("reads a paraphrase as evidence", () => {
    // "observability" appears nowhere in this CV; production monitoring does.
    const written = nearPerfectResume();
    const { coverage } = computeCoverage(written, analysis);

    const observability = analysis.requirements.find(
      (requirement) => requirement.name === "Observability",
    )!;
    const verdict = coverage.requirements.find(
      (entry) => entry.requirementId === observability.id,
    )!;

    expect(resumeElements(written).some((element) => /observability/i.test(element.text))).toBe(
      false,
    );
    expect(verdict.match).not.toBe("missing");
  });

  it("gains nothing from saying the same word six times", () => {
    const once = partialResume();
    const stuffed = withBullet(once, "React React React React React React React React.");

    expect(score(stuffed)).toBe(score(once));
  });
});
