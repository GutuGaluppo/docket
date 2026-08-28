"use client";

import type { AnalysisStep } from "@/lib/tailoring/steps";

/**
 * The checklist, drawn from what the server has actually reported reaching.
 *
 * Three states have to be distinguishable without colour and without motion,
 * because a reader with a forced-colours theme gets neither and a reader who
 * asked for reduced motion has turned the third off: the mark itself carries
 * the meaning, and the words beside it are announced.
 */
export function AnalysisStepList({ steps }: { steps: readonly AnalysisStep[] }) {
  return (
    <ol className="cv-steps-list">
      {steps.map((step) => (
        <AnalysisStepItem key={step.id} step={step} />
      ))}
    </ol>
  );
}

const MARKS: Record<AnalysisStep["status"], string> = {
  pending: "○",
  active: "●",
  completed: "✓",
  error: "!",
};

const SAID: Record<AnalysisStep["status"], string> = {
  pending: "not started",
  active: "in progress",
  completed: "done",
  error: "failed",
};

function AnalysisStepItem({ step }: { step: AnalysisStep }) {
  return (
    <li className="cv-step" data-status={step.status}>
      <span aria-hidden="true" className="cv-step-mark">
        {MARKS[step.status]}
      </span>
      <span className="cv-step-title">{step.title}</span>
      <span className="sr-only">, {SAID[step.status]}</span>
    </li>
  );
}
