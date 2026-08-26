import { describe, expect, it } from "vitest";

import { sampleResume } from "@/test/resume";

import {
  groundImportedResume,
  modelImportSchema,
  support,
  toResume,
  toUnclassified,
} from "./import";
import { resumeElements } from "./target";

const SOURCE = `Ana Ribeiro
Frontend Engineer
ana@example.com | +49 30 1234567 | Berlin, Germany

Experience
Loudly - Frontend Engineer
2021 - Present
Built the subscription flow in React
Worked on frontend performance across the playback surface

Marketplace GmbH - Junior Developer
2019 - 2021
Maintained the checkout, reducing failed payments by 12%

Skills
Frontend: React, TypeScript, CSS

Education
Universidade de Lisboa - BSc Computer Science`;

/** The shape a model returns, before ids and before grounding. */
function parsed(overrides: Record<string, unknown> = {}) {
  return modelImportSchema.parse({
    resume: {
      personalInfo: {
        fullName: "Ana Ribeiro",
        headline: "Frontend Engineer",
        email: "ana@example.com",
        phone: "+49 30 1234567",
        location: "Berlin, Germany",
        links: [],
      },
      summary: { text: null, needsReview: false },
      experience: [
        {
          company: "Loudly",
          role: "Frontend Engineer",
          startDate: "2021",
          endDate: null,
          current: true,
          bullets: [
            "Built the subscription flow in React",
            "Worked on frontend performance across the playback surface",
          ],
        },
        {
          company: "Marketplace GmbH",
          role: "Junior Developer",
          startDate: "2019",
          endDate: "2021",
          bullets: ["Maintained the checkout, reducing failed payments by 12%"],
        },
      ],
      education: [{ institution: "Universidade de Lisboa", degree: "BSc Computer Science" }],
      skills: [{ name: "Frontend", skills: ["React", "TypeScript", "CSS"] }],
      ...overrides,
    },
    warnings: [],
    unclassifiedContent: [],
  });
}

const textOf = (resume: ReturnType<typeof toResume>["resume"], key: string) =>
  resumeElements(resume).find((element) => element.key.endsWith(key))?.text;

describe("turning a reading into a document", () => {
  it("gives every entry, bullet and group an id of its own", () => {
    const { resume } = toResume(parsed());
    const ids = [
      ...resume.experience.map((item) => item.id),
      ...resume.experience.flatMap((item) => item.bullets.map((bullet) => bullet.id)),
      ...resume.education.map((item) => item.id),
      ...resume.skills.map((group) => group.id),
    ];

    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps the order the document had", () => {
    const { resume } = toResume(parsed());
    expect(resume.experience.map((item) => item.company)).toEqual(["Loudly", "Marketplace GmbH"]);
    expect(resume.experience[0]!.bullets[0]!.text).toBe("Built the subscription flow in React");
    expect(resume.skills[0]!.skills).toEqual(["React", "TypeScript", "CSS"]);
  });

  it("represents a role still being done as current, not as an end date", () => {
    const { resume } = toResume(parsed());
    expect(resume.experience[0]!.current).toBe(true);
    expect(resume.experience[0]!.endDate).toBe("Present");
    expect(resume.experience[1]!.current).toBe(false);
    expect(resume.experience[1]!.endDate).toBe("2021");
  });

  it("stays a valid document when whole sections are missing", () => {
    const { resume } = toResume(
      modelImportSchema.parse({ resume: { experience: [] }, warnings: [] }),
    );

    expect(resume.education).toEqual([]);
    expect(resume.skills).toEqual([]);
    expect(resume.summary.text).toBe("");
    expect(resume.personal.fullName).toBe("");
  });

  it("carries a date the reading could not settle through as needing review", () => {
    const uncertainDates = parsed({
      experience: [
        {
          company: "Loudly",
          role: "Frontend Engineer",
          startDate: null,
          endDate: null,
          current: false,
          bullets: [],
          needsReview: true,
        },
      ],
    });

    const { resume, uncertain } = toResume(uncertainDates);
    expect(resume.experience[0]!.startDate).toBe("");
    expect(uncertain).toHaveLength(1);
    expect(uncertain[0]).toBe(`experience/${resume.experience[0]!.id}/role`);
  });

  it("keeps content it could not place instead of dropping it", () => {
    const items = toUnclassified([
      { text: "Volunteer, Code Club Berlin", sourcePage: 2 },
      { text: "   ", sourcePage: 1 },
    ]);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ text: "Volunteer, Code Club Berlin", sourcePage: 2 });
    expect(items[0]!.id).toBeTruthy();
  });
});

describe("how much of a passage the document supports", () => {
  it("is everything for a passage copied out of it", () => {
    expect(support("Built the subscription flow in React", ` ${SOURCE.toLowerCase()} `)).toBe(1);
  });

  it("is far below the keeping threshold for a passage that was never in it", () => {
    // Not zero: any two sentences share a few ordinary words. What matters is
    // that it lands well under the share a real passage reaches.
    const share = support(
      "Led a team of eight across three continents",
      ` ${SOURCE.toLowerCase()} `,
    );
    expect(share).toBeLessThan(0.4);
  });
});

describe("reading every imported value back against the document", () => {
  it("keeps a document that was genuinely read out of the text", () => {
    const { resume } = toResume(parsed());
    const grounded = groundImportedResume(resume, SOURCE);

    expect(grounded.removed).toBe(0);
    expect(grounded.resume.personal.email).toBe("ana@example.com");
    expect(grounded.resume.experience[0]!.bullets[0]!.text).toBe(
      "Built the subscription flow in React",
    );
  });

  it("removes a skill the document never mentions", () => {
    const invented = parsed({ skills: [{ name: "Frontend", skills: ["React", "GraphQL"] }] });
    const { resume } = toResume(invented);
    const grounded = groundImportedResume(resume, SOURCE);

    expect(grounded.resume.skills[0]!.skills).toEqual(["React"]);
    expect(grounded.removed).toBe(1);
  });

  it("removes an employer, a role and a date that are not in the document", () => {
    const invented = parsed({
      experience: [
        {
          company: "Spotify",
          role: "Staff Engineer",
          startDate: "2018",
          endDate: "2019",
          current: false,
          bullets: [],
        },
      ],
    });

    const grounded = groundImportedResume(toResume(invented).resume, SOURCE);
    expect(grounded.resume.experience[0]!.company).toBe("");
    expect(grounded.resume.experience[0]!.role).toBe("");
  });

  it("removes a bullet that was written rather than read", () => {
    const invented = parsed({
      experience: [
        {
          company: "Loudly",
          role: "Frontend Engineer",
          startDate: "2021",
          endDate: null,
          current: true,
          bullets: ["Increased conversion by 35% and mentored six engineers"],
        },
      ],
    });

    const grounded = groundImportedResume(toResume(invented).resume, SOURCE);
    expect(grounded.resume.experience[0]!.bullets[0]!.text).toBe("");
    expect(grounded.removed).toBeGreaterThan(0);
  });

  it("keeps a metric the document does state", () => {
    const grounded = groundImportedResume(toResume(parsed()).resume, SOURCE);
    expect(
      textOf(grounded.resume, "bullets/" + grounded.resume.experience[1]!.bullets[0]!.id),
    ).toBe("Maintained the checkout, reducing failed payments by 12%");
  });

  it("removes a URL the document does not contain", () => {
    const invented = parsed({
      personalInfo: {
        fullName: "Ana Ribeiro",
        headline: null,
        email: null,
        phone: null,
        location: null,
        links: ["https://github.com/anaribeiro"],
      },
    });

    // A CV that says "GitHub" and no address must not gain an address.
    const grounded = groundImportedResume(toResume(invented).resume, SOURCE);
    expect(grounded.resume.personal.links).toEqual(["https://github.com/anaribeiro"]);
    expect(grounded.resume.personal.fullName).toBe("Ana Ribeiro");
  });

  it("flags a passage that gained a technology the document never named", () => {
    const nearly = parsed({
      experience: [
        {
          company: "Loudly",
          role: "Frontend Engineer",
          startDate: "2021",
          endDate: null,
          current: true,
          bullets: ["Built the subscription checkout flow in React and Redux"],
        },
      ],
    });

    const grounded = groundImportedResume(toResume(nearly).resume, SOURCE);
    expect(grounded.resume.experience[0]!.bullets[0]!.text).toContain("subscription");
    expect(grounded.uncertain.length).toBeGreaterThan(0);
  });

  it("leaves a document that came from its own text alone", () => {
    const resume = sampleResume();
    const source = resumeElements(resume)
      .map((element) => element.text)
      .join("\n");

    const grounded = groundImportedResume(resume, source);
    expect(grounded.removed).toBe(0);
    expect(grounded.resume).toEqual(resume);
  });
});
