import { describe, expect, it } from "vitest";

import { resumeElements } from "@/lib/resume/target";
import { sampleResume } from "@/test/resume";

import { analysisFreshness, fingerprintJob, fingerprintResume } from "./fingerprint";

describe("the fingerprint of a document", () => {
  it("is the same for the same document", () => {
    expect(fingerprintResume(sampleResume())).toBe(fingerprintResume(sampleResume()));
  });

  it("changes when a single bullet changes", () => {
    const before = sampleResume();
    const bullet = resumeElements(before).find((element) => element.target.itemId === "bul-1")!;

    expect(fingerprintResume(bullet.write("Owned frontend performance."))).not.toBe(
      fingerprintResume(before),
    );
  });

  it("comes back when the change is undone", () => {
    const before = sampleResume();
    const original = fingerprintResume(before);

    const bullet = resumeElements(before).find((element) => element.target.itemId === "bul-1")!;
    const edited = bullet.write("Something else.");
    const restored = resumeElements(edited).find((element) => element.target.itemId === "bul-1")!;

    // A document put back to what it said is not stale, whatever the clock says.
    expect(fingerprintResume(restored.write(bullet.text))).toBe(original);
  });

  it("treats a reflowed advert as the same advert", () => {
    expect(fingerprintJob("Senior   Frontend\n\nEngineer ")).toBe(
      fingerprintJob("Senior Frontend Engineer"),
    );
  });

  it("tells two adverts apart", () => {
    expect(fingerprintJob("Frontend Engineer")).not.toBe(fingerprintJob("Backend Engineer"));
  });
});

describe("whether a stored reading still describes what is on screen", () => {
  const fingerprint = {
    resumeId: "cv-a",
    resumeFingerprint: "aaa",
    jobFingerprint: "jjj",
    scoringVersion: "2",
    promptVersion: "2",
  };

  const base = { analysis: fingerprint, current: fingerprint };

  it("is current when both documents are as they were", () => {
    expect(analysisFreshness(base)).toBe("current");
  });

  it("is stale when the CV has been edited", () => {
    expect(
      analysisFreshness({ ...base, current: { ...fingerprint, resumeFingerprint: "bbb" } }),
    ).toBe("stale-resume");
  });

  it("is stale when the advert is a different advert", () => {
    expect(analysisFreshness({ ...base, current: { ...fingerprint, jobFingerprint: "kkk" } })).toBe(
      "stale-job",
    );
  });

  it("is stale when the scoring changed underneath it", () => {
    // Section 48: a figure from an older algorithm is not a stale reading of
    // the same documents, it is an answer to a different question.
    expect(analysisFreshness({ ...base, current: { ...fingerprint, scoringVersion: "3" } })).toBe(
      "stale-scoring",
    );
    expect(analysisFreshness({ ...base, current: { ...fingerprint, promptVersion: "3" } })).toBe(
      "stale-scoring",
    );
  });

  /**
   * The requirement in section 57, which is the one that would be embarrassing
   * to get wrong: a figure computed for one CV must never appear beside
   * another, not even as something offered for refresh.
   */
  it("belongs to another CV, which is not staleness", () => {
    expect(analysisFreshness({ ...base, current: { ...fingerprint, resumeId: "cv-b" } })).toBe(
      "other-resume",
    );
    expect(
      analysisFreshness({
        ...base,
        current: {
          ...fingerprint,
          resumeId: "cv-b",
          resumeFingerprint: "zzz",
          jobFingerprint: "zzz",
        },
      }),
    ).toBe("other-resume");
  });
});
