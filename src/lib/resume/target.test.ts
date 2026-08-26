import { describe, expect, it } from "vitest";

import { sampleResume } from "@/test/resume";

import { blankResume } from "./schema";
import {
  elementDomId,
  resolveTarget,
  resumeElements,
  targetKey,
  toTarget,
  writeTarget,
} from "./target";

const resume = sampleResume();
const elements = resumeElements(resume);

describe("addressing the document", () => {
  it("reaches every level, from a section down to a bullet", () => {
    expect(targetKey({ sectionId: "summary", fieldId: "text" })).toBe("summary/text");
    expect(targetKey({ sectionId: "skills", entryId: "skl-front" })).toBe("skills/skl-front");
    expect(
      targetKey({
        sectionId: "experience",
        entryId: "exp-loudly",
        fieldId: "bullets",
        itemId: "bul-1",
      }),
    ).toBe("experience/exp-loudly/bullets/bul-1");
  });

  it("gives every element a breadcrumb a reader can follow", () => {
    const bullet = elements.find((element) => element.target.itemId === "bul-2")!;
    expect(bullet.path).toEqual(["Experience", "Loudly — Frontend Engineer", "Bullet 2"]);
  });

  it("sorts each piece of text into the area that decides what it is worth", () => {
    const area = (key: string) => elements.find((element) => element.key === key)?.area;
    expect(area("personal/headline")).toBe("headline");
    expect(area("summary/text")).toBe("summary");
    expect(area("experience/exp-loudly/bullets/bul-1")).toBe("experience");
    expect(area("skills/skl-front")).toBe("skills");
  });

  it("reads a skill group as the line a person edits", () => {
    const group = elements.find((element) => element.key === "skills/skl-front")!;
    expect(group.text).toBe("React, TypeScript, CSS");
  });

  it("makes a DOM id that survives the characters an id can hold", () => {
    expect(elementDomId("experience/exp-loudly/bullets/bul-1")).toBe(
      "cv-experience_exp-loudly_bullets_bul-1",
    );
  });
});

describe("resolving an address", () => {
  it("answers with the exact element when it exists", () => {
    const target = {
      sectionId: "experience",
      entryId: "exp-loudly",
      fieldId: "bullets",
      itemId: "bul-1",
    } as const;
    expect(resolveTarget(resume, target)?.text).toBe(
      "Worked on frontend performance across the playback surface.",
    );
  });

  it("falls back to the first element of a section named on its own", () => {
    expect(resolveTarget(resume, { sectionId: "summary" })?.key).toBe("summary/text");
    expect(resolveTarget(resume, { sectionId: "skills" })?.key).toBe("skills/skl-front");
  });

  it("answers with nothing for an entry that is gone", () => {
    expect(resolveTarget(resume, { sectionId: "experience", entryId: "exp-nope" })).toBeNull();
  });

  it("answers with nothing for a bullet that is gone", () => {
    expect(
      resolveTarget(resume, {
        sectionId: "experience",
        entryId: "exp-loudly",
        fieldId: "bullets",
        itemId: "bul-gone",
      }),
    ).toBeNull();
  });

  it("refuses a section this document has never heard of", () => {
    expect(toTarget({ targetSectionId: "salary" })).toBeNull();
    expect(toTarget({ targetSectionId: "skills", targetEntryId: "" })).toEqual({
      sectionId: "skills",
      entryId: undefined,
      fieldId: undefined,
      itemId: undefined,
    });
  });
});

describe("writing through an address", () => {
  it("changes one element and copies the rest", () => {
    const next = writeTarget(
      resume,
      { sectionId: "experience", entryId: "exp-loudly", fieldId: "bullets", itemId: "bul-1" },
      "Owned the performance work.",
    )!;

    expect(next.experience[0]!.bullets[0]!.text).toBe("Owned the performance work.");
    expect(next.experience[0]!.bullets[1]).toEqual(resume.experience[0]!.bullets[1]);
    expect(next.summary).toEqual(resume.summary);
  });

  it("splits a skill line back into skills", () => {
    const next = writeTarget(
      resume,
      { sectionId: "skills", entryId: "skl-tools" },
      "Docker, Git, CI",
    )!;
    expect(next.skills[1]!.skills).toEqual(["Docker", "Git", "CI"]);
  });

  it("keeps the ids it was given", () => {
    const next = writeTarget(resume, { sectionId: "summary", fieldId: "text" }, "New summary.")!;
    expect(next.experience.map((entry) => entry.id)).toEqual(["exp-loudly", "exp-market"]);
  });

  it("answers with nothing rather than guessing where to write", () => {
    expect(writeTarget(resume, { sectionId: "projects", entryId: "prj-x" }, "…")).toBeNull();
  });
});

describe("a document that has just been created", () => {
  it("is addressable from the first render", () => {
    const keys = resumeElements(blankResume()).map((element) => element.key);
    expect(keys).toContain("summary/text");
    expect(keys.some((key) => key.startsWith("experience/"))).toBe(true);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
