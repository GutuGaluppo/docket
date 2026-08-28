export type AnalysisStepId = "resume" | "job" | "compare" | "score" | "suggestions";

export type AnalysisStepStatus = "pending" | "active" | "completed" | "error";

export type AnalysisStep = {
  id: AnalysisStepId;
  title: string;
  status: AnalysisStepStatus;
};

/**
 * The stages of a reading, named once.
 *
 * Every one of these is a real milestone the server passes and reports as it
 * passes it — the list is not a script played on a timer. That constraint is
 * what decides the shape of it: keyword coverage, role alignment and the
 * weighted figure are one computation over the same data, so they are one step
 * called "Calculating Job Match" rather than three that would appear to be
 * observed separately and would not be.
 *
 * The titles say what is happening to the person's documents. "Sending the
 * request" and "validating the schema" are true and belong in a log, not on a
 * screen somebody is waiting at.
 */
export const ANALYSIS_STEPS: ReadonlyArray<{ id: AnalysisStepId; title: string }> = [
  { id: "resume", title: "Reading your CV" },
  { id: "job", title: "Understanding the job description" },
  { id: "compare", title: "Matching your experience with the role" },
  { id: "score", title: "Calculating Job Match" },
  { id: "suggestions", title: "Preparing recommendations" },
];

/** What the server sends as it goes. One line per event. */
export type AnalysisEvent = {
  step: AnalysisStepId;
  status: "active" | "completed" | "error";
};

export function initialSteps(): AnalysisStep[] {
  return ANALYSIS_STEPS.map((step) => ({ ...step, status: "pending" as const }));
}

const order = (id: AnalysisStepId) => ANALYSIS_STEPS.findIndex((step) => step.id === id);

/**
 * One event, folded in.
 *
 * A step going active implies the ones before it finished, which is what keeps
 * the list honest when an event is dropped or arrives out of order: the
 * checklist can only ever show what the server has actually reported reaching,
 * never a step it hoped was done by now.
 */
export function applyEvent(steps: readonly AnalysisStep[], event: AnalysisEvent): AnalysisStep[] {
  const at = order(event.step);
  if (at === -1) return [...steps];

  return steps.map((step, index) => {
    if (index < at) {
      // Never walk a finished step backwards.
      return step.status === "error" ? step : { ...step, status: "completed" as const };
    }
    if (index > at) return step;
    return { ...step, status: event.status };
  });
}

/** Everything done, for the moment the result lands. */
export function completeSteps(steps: readonly AnalysisStep[]): AnalysisStep[] {
  return steps.map((step) => ({ ...step, status: "completed" as const }));
}

/**
 * A failure, marked where it happened.
 *
 * The steps that had finished stay finished — resetting the whole list would
 * throw away the one piece of information a failed reading still carries, which
 * is how far it got.
 */
export function failSteps(steps: readonly AnalysisStep[]): AnalysisStep[] {
  const active = steps.findIndex((step) => step.status === "active");
  const at = active === -1 ? steps.findIndex((step) => step.status === "pending") : active;

  return steps.map((step, index) => (index === at ? { ...step, status: "error" as const } : step));
}

/** The step the reading is on, for a one-line summary of where it has got to. */
export function currentStep(steps: readonly AnalysisStep[]): AnalysisStep | null {
  return steps.find((step) => step.status === "active") ?? null;
}
