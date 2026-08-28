import { describe, expect, it } from "vitest";

import { sampleResume } from "@/test/resume";

import { addBullet, addEntry, cloneResume, removeBullet, removeEntry } from "./edit";
import { resumeElements } from "./target";

describe("copying a document", () => {
  const source = sampleResume();
  const copy = cloneResume(source);

  it("says the same thing", () => {
    const text = (resume: typeof source) =>
      resumeElements(resume)
        .map((element) => element.text)
        .join("\n");

    expect(text(copy)).toBe(text(source));
  });

  it("shares no id with what it was copied from", () => {
    const ids = (resume: typeof source) => [
      ...resume.experience.map((entry) => entry.id),
      ...resume.experience.flatMap((entry) => entry.bullets.map((bullet) => bullet.id)),
      ...resume.skills.map((group) => group.id),
      ...resume.education.map((entry) => entry.id),
    ];

    const before = new Set(ids(source));
    for (const id of ids(copy)) expect(before.has(id)).toBe(false);
  });

  it("changes on one side leave the other alone", () => {
    const edited = resumeElements(copy).find((element) => element.target.itemId)!;
    const changed = edited.write("Rewritten for another job entirely.");

    expect(resumeElements(source).find((element) => element.key === edited.key)).toBeUndefined();
    expect(source.experience[0]!.bullets[0]!.text).toBe(
      "Worked on frontend performance across the playback surface.",
    );
    expect(changed.experience[0]!.bullets[0]!.text).toBe("Rewritten for another job entirely.");
  });
});

describe("adding and removing", () => {
  it("adds an entry to the section named", () => {
    const next = addEntry(sampleResume(), "education");
    expect(next.education).toHaveLength(2);
    expect(next.experience).toHaveLength(2);
  });

  it("removes only the entry named", () => {
    const next = removeEntry(sampleResume(), "experience", "exp-loudly");
    expect(next.experience.map((entry) => entry.id)).toEqual(["exp-market"]);
  });

  it("adds and removes bullets inside one entry", () => {
    const added = addBullet(sampleResume(), "experience", "exp-loudly");
    expect(added.experience[0]!.bullets).toHaveLength(3);
    expect(added.experience[1]!.bullets).toHaveLength(1);

    const removed = removeBullet(added, "experience", "exp-loudly", "bul-1");
    expect(removed.experience[0]!.bullets.map((bullet) => bullet.id)).not.toContain("bul-1");
  });
});
