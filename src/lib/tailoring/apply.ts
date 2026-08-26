import type { Resume } from "@/lib/resume/schema";
import { resolveTarget, targetKey, toTarget } from "@/lib/resume/target";

import type { ResumeChange, ResumeSuggestion } from "./types";

/**
 * Applying a recommendation, and taking it back.
 *
 * Nothing here decides anything: a suggestion is applied because a person
 * pressed Apply, with the text that was on screen when they did — the model's
 * wording, or the version they edited first. The model never reaches this
 * function on its own.
 *
 * One write, one record. The record holds the value that was there before,
 * which is the whole of Undo: restoring is writing the previous value back to
 * the same address, and it works just as well an hour and six changes later as
 * it does immediately.
 */

export type AppliedChange = { resume: Resume; change: ResumeChange };

/** Applies `text` at the suggestion's address. Null when the address is gone. */
export function applySuggestion(
  resume: Resume,
  suggestion: ResumeSuggestion,
  text: string,
): AppliedChange | null {
  const target = toTarget(suggestion);
  if (!target) return null;

  const element = resolveTarget(resume, target);
  if (!element) return null;

  const next = text.trim();
  if (next === element.text.trim()) return null;

  return {
    resume: element.write(next),
    change: {
      id: `chg-${crypto.randomUUID().slice(0, 8)}`,
      suggestionId: suggestion.id,
      targetId: element.key,
      target: element.target,
      previousValue: element.text,
      nextValue: next,
      createdAt: new Date().toISOString(),
    },
  };
}

/**
 * Puts a change back.
 *
 * Deliberately unconditional about what the field holds now: if the person
 * edited the text further after applying, Undo still restores what was there
 * before the suggestion, because that is what the button says it does. What it
 * will not do is write into an address that no longer exists.
 */
export function revertChange(resume: Resume, change: ResumeChange): Resume | null {
  const element = resolveTarget(resume, change.target);
  if (!element) return null;
  if (element.key !== change.targetId && targetKey(change.target) !== change.targetId) return null;
  return element.write(change.previousValue);
}
