import { describe, expect, it } from "vitest";

import { parseResumeText } from "./parse";

const PASTED = `Ana Ribeiro
Frontend Engineer
ana@example.com | +49 30 1234567 | Berlin, Germany

Summary
Frontend engineer building product interfaces in React, with five years across
music and marketplace teams.

Experience
Loudly — Frontend Engineer
2021 – present
• Worked on frontend performance across the playback surface
• Built the subscription flow in React

Marketplace GmbH — Junior Developer
2019 – 2021
- Maintained the checkout, reducing failed payments by 12%

Education
Universidade de Lisboa — BSc Computer Science
2015 – 2019

Skills
Frontend: React, TypeScript, CSS
Tooling: Docker, Git

Languages
Portuguese (Native), English (C1)
`;

const resume = parseResumeText(PASTED);

describe("reading a pasted CV", () => {
  it("takes the name and the title off the top", () => {
    expect(resume.personal.fullName).toBe("Ana Ribeiro");
    expect(resume.personal.headline).toBe("Frontend Engineer");
  });

  it("finds the contact details wherever in the line they sit", () => {
    expect(resume.personal.email).toBe("ana@example.com");
    expect(resume.personal.phone).toBe("+49 30 1234567");
    expect(resume.personal.location).toBe("Berlin, Germany");
  });

  it("keeps the summary as written", () => {
    expect(resume.summary.text).toMatch(/^Frontend engineer building product interfaces in React/);
  });

  it("splits the roles and attaches each bullet to the one above it", () => {
    expect(resume.experience).toHaveLength(2);
    expect(resume.experience[0]).toMatchObject({
      company: "Loudly",
      role: "Frontend Engineer",
      startDate: "2021",
      endDate: "present",
    });
    expect(resume.experience[0]!.bullets.map((bullet) => bullet.text)).toEqual([
      "Worked on frontend performance across the playback surface",
      "Built the subscription flow in React",
    ]);
    expect(resume.experience[1]!.bullets).toHaveLength(1);
  });

  it("reads a labelled skills line as a named group", () => {
    expect(resume.skills.map((group) => group.name)).toEqual(["Frontend", "Tooling"]);
    expect(resume.skills[0]!.skills).toEqual(["React", "TypeScript", "CSS"]);
  });

  it("reads education and languages", () => {
    expect(resume.education[0]).toMatchObject({
      institution: "Universidade de Lisboa",
      degree: "BSc Computer Science",
    });
    expect(resume.languages.map((language) => language.name)).toEqual(["Portuguese", "English"]);
    expect(resume.languages[0]!.level).toBe("Native");
  });

  it("gives everything it read a stable id", () => {
    const ids = [
      ...resume.experience.map((entry) => entry.id),
      ...resume.experience.flatMap((entry) => entry.bullets.map((bullet) => bullet.id)),
      ...resume.skills.map((group) => group.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every(Boolean)).toBe(true);
  });

  it("never throws on text that has no shape at all", () => {
    const shapeless = parseResumeText("just some words about me and my work");
    expect(shapeless.personal.fullName).toBe("just some words about me and my work");
    expect(shapeless.experience).toEqual([]);
  });

  it("survives a PDF that came out as one very long line", () => {
    // What a PDF exported without line breaks looks like. Every field the
    // schema caps has to be cut rather than rejected, or the import fails.
    const flattened = parseResumeText(
      "Ana Ribeiro Frontend Engineer ana@example.com Berlin ".repeat(20),
    );

    expect(flattened.personal.fullName.length).toBeLessThanOrEqual(160);
    expect(() => parseResumeText("x".repeat(50_000))).not.toThrow();
  });

  it("returns an empty document for empty text", () => {
    const empty = parseResumeText("");
    expect(empty.experience).toEqual([]);
    expect(empty.summary.text).toBe("");
  });
});
