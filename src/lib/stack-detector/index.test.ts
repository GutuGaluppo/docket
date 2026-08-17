import { describe, expect, it } from "vitest";

import { detectStack, resolveTags } from "./index";

describe("detectStack", () => {
  it("returns nothing for empty or blank input", () => {
    expect(detectStack("")).toEqual([]);
    expect(detectStack("   \n\t ")).toEqual([]);
  });

  it("finds technologies in the order they appear", () => {
    expect(detectStack("We use TypeScript, React and PostgreSQL.")).toEqual([
      "TypeScript",
      "React",
      "PostgreSQL",
    ]);
  });

  it("does not repeat a technology mentioned twice", () => {
    expect(detectStack("React here, React there, react everywhere")).toEqual(["React"]);
  });

  // The three regressions called out in the brief.
  it("does not turn 'React Native' into 'React'", () => {
    expect(detectStack("Looking for a React Native developer")).toEqual(["React Native"]);
  });

  it("does not turn 'JavaScript' into 'Java'", () => {
    expect(detectStack("Strong JavaScript fundamentals")).toEqual(["JavaScript"]);
    expect(detectStack("JavaScript and Java")).toEqual(["JavaScript", "Java"]);
  });

  it("does not turn 'go live' into 'Go'", () => {
    expect(detectStack("You will help features go live every week")).toEqual([]);
    expect(detectStack("Backend in Golang")).toEqual(["Go"]);
  });

  it("keeps React when React Native appears later in the ad", () => {
    const result = detectStack("Our web app is React. The mobile app is React Native.");
    expect(result).toEqual(["React", "React Native"]);
  });

  it("respects word boundaries", () => {
    expect(detectStack("nodejsx")).toEqual([]);
    expect(detectStack("prereact")).toEqual([]);
    expect(detectStack("We deploy with Node.js")).toEqual(["Node.js"]);
  });

  it("matches punctuation-heavy aliases", () => {
    expect(detectStack("Experience with C++ required")).toEqual(["C++"]);
    expect(detectStack("Backend in C# and .NET")).toEqual([".NET / C#"]);
    expect(detectStack("Familiar with CI/CD pipelines")).toEqual(["CI/CD"]);
  });

  it("collapses aliases onto one label", () => {
    expect(detectStack("Vue.js and vuejs and vue")).toEqual(["Vue"]);
  });

  it("is case insensitive", () => {
    expect(detectStack("TAILWIND CSS and typescript")).toEqual(["Tailwind CSS", "TypeScript"]);
  });

  it("handles a realistic ad", () => {
    const ad = `Senior Frontend Engineer (m/f/d)

      You'll work with React, TypeScript and Next.js, with a Node.js/GraphQL
      backend deployed on AWS. We care about accessibility and run our tests
      with Playwright. Bonus: experience with Kubernetes.`;
    expect(detectStack(ad)).toEqual([
      "React",
      "TypeScript",
      "Next.js",
      "Node.js",
      "GraphQL",
      "AWS",
      "Accessibility (a11y)",
      "Playwright",
      "Kubernetes",
    ]);
  });
});

describe("resolveTags", () => {
  it("keeps detected tags and appends manual ones", () => {
    expect(resolveTags({ detected: ["React"], dismissed: [], manual: ["Figma"] })).toEqual([
      "React",
      "Figma",
    ]);
  });

  it("drops dismissed tags", () => {
    expect(resolveTags({ detected: ["React", "Vue"], dismissed: ["Vue"], manual: [] })).toEqual([
      "React",
    ]);
  });

  it("does not duplicate a manual tag that the detector already found", () => {
    expect(resolveTags({ detected: ["React"], dismissed: [], manual: ["react"] })).toEqual([
      "React",
    ]);
  });

  it("does not duplicate repeated manual tags", () => {
    expect(resolveTags({ detected: [], dismissed: [], manual: ["Rust", "rust"] })).toEqual([
      "Rust",
    ]);
  });
});
