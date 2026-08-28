import { describe, expect, it } from "vitest";

import {
  ANALYSIS_STEPS,
  applyEvent,
  completeSteps,
  currentStep,
  failSteps,
  initialSteps,
} from "./steps";

const statuses = (steps: ReturnType<typeof initialSteps>) => steps.map((step) => step.status);

describe("the checklist", () => {
  it("starts with everything ahead of it", () => {
    expect(statuses(initialSteps())).toEqual([
      "pending",
      "pending",
      "pending",
      "pending",
      "pending",
    ]);
  });

  it("names each stage in words about the documents, not about the machinery", () => {
    const titles = ANALYSIS_STEPS.map((step) => step.title)
      .join(" ")
      .toLowerCase();
    for (const jargon of ["json", "schema", "request", "embedding", "token", "prompt"]) {
      expect(titles).not.toContain(jargon);
    }
  });

  it("marks a stage active and everything before it done", () => {
    const steps = applyEvent(initialSteps(), { step: "compare", status: "active" });
    expect(statuses(steps)).toEqual(["completed", "completed", "active", "pending", "pending"]);
    expect(currentStep(steps)?.id).toBe("compare");
  });

  it("never walks a finished stage backwards", () => {
    const advanced = applyEvent(initialSteps(), { step: "score", status: "active" });
    const late = applyEvent(advanced, { step: "job", status: "active" });

    // An event arriving out of order cannot un-finish what the server already
    // reported passing.
    expect(late[0]!.status).toBe("completed");
  });

  it("finishes everything when the result lands", () => {
    const steps = completeSteps(applyEvent(initialSteps(), { step: "score", status: "active" }));
    expect(statuses(steps).every((status) => status === "completed")).toBe(true);
    expect(currentStep(steps)).toBeNull();
  });

  it("marks a failure where it happened and keeps what had finished", () => {
    const running = applyEvent(initialSteps(), { step: "compare", status: "active" });
    const failed = failSteps(running);

    expect(statuses(failed)).toEqual(["completed", "completed", "error", "pending", "pending"]);
  });

  it("marks the first unstarted stage when a failure arrives between stages", () => {
    const between = applyEvent(initialSteps(), { step: "job", status: "completed" });
    expect(failSteps(between).find((step) => step.status === "error")?.id).toBe("compare");
  });
});
