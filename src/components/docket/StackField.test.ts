import { describe, expect, it } from "vitest";

import { detectStack, resolveTags } from "@/lib/stack-detector";
import { seedStack } from "./StackField";

const DESCRIPTION = "We use React, TypeScript and Node.js here.";

/**
 * The round trip that matters: an entry loaded for correction and saved again
 * untouched must come back with exactly the tags it had. Everything the detector
 * derives is recomputed from the description, so the saved list survives only if
 * the edits on top of it are reconstructed correctly.
 */
const roundTrip = (description: string, tags: readonly string[]) => {
  const seed = seedStack({ description, tags });
  return resolveTags({
    detected: detectStack(description),
    dismissed: seed.dismissed,
    manual: seed.manual,
  });
};

describe("seedStack", () => {
  it("adds nothing when the saved tags are exactly what the text produces", () => {
    const tags = detectStack(DESCRIPTION);
    expect(seedStack({ description: DESCRIPTION, tags })).toEqual({ manual: [], dismissed: [] });
  });

  it("treats a tag absent from the text as one typed by hand", () => {
    const tags = [...detectStack(DESCRIPTION), "Figma"];
    expect(seedStack({ description: DESCRIPTION, tags }).manual).toEqual(["Figma"]);
  });

  it("treats a tag the text produces but the entry does not keep as removed", () => {
    const tags = detectStack(DESCRIPTION).filter((tag) => tag !== "React");
    expect(seedStack({ description: DESCRIPTION, tags }).dismissed).toEqual(["React"]);
  });

  it("survives an entry saved with no description at all", () => {
    expect(seedStack({ description: "", tags: ["Go", "Kubernetes"] })).toEqual({
      manual: ["Go", "Kubernetes"],
      dismissed: [],
    });
  });

  it("round-trips every shape without rewriting the saved list", () => {
    const cases: Array<readonly string[]> = [
      detectStack(DESCRIPTION),
      [...detectStack(DESCRIPTION), "Figma"],
      detectStack(DESCRIPTION).filter((tag) => tag !== "React"),
      ["Go"],
      [],
    ];
    for (const tags of cases) {
      expect(roundTrip(DESCRIPTION, tags).sort()).toEqual([...tags].sort());
    }
  });
});
