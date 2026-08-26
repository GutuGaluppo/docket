import { detectStack } from "@/lib/stack-detector";
import type { Resume } from "@/lib/resume/schema";
import { resolveTarget, toTarget } from "@/lib/resume/target";
import { resumeText } from "@/lib/resume/text";

import { containsTerm, normalize } from "./match";
import type { ResumeSuggestion } from "./types";

/**
 * The check that stands between the model and the reader.
 *
 * Section 26 is a list of things the model must never do, and a prompt is a
 * request, not a guarantee. This module is the guarantee: every rewrite the
 * model proposes is read back against the CV, and anything it added that the CV
 * does not already say is removed before a human ever sees an Apply button next
 * to it.
 *
 * Two kinds of invention are caught here, because they are the two that damage
 * a candidate in an interview:
 *
 *   · a number that is not in the CV — "improved performance by 40%" where the
 *     document never said 40, or 20, or anything;
 *   · a technology that is not in the CV — a bullet rewritten to mention
 *     GraphQL because the advert wanted GraphQL.
 *
 * Neither is deleted from the interface. The recommendation survives, stripped
 * of its text, as what it honestly was: a gap, or a question only the candidate
 * can answer.
 */

export type GroundingResult = {
  suggestions: ResumeSuggestion[];
  /** Counts only — no content ever leaves this module. */
  dropped: number;
  stripped: number;
};

const NUMBER = /\d[\d.,]*\s?%?/g;

/** Digits in the proposed text that appear nowhere in the document. */
export function unsupportedNumbers(suggested: string, sources: string[]): string[] {
  const haystack = sources.join(" ").replace(/[.,]/g, "");
  const found = suggested.match(NUMBER) ?? [];

  const unsupported = found
    .map((raw) => raw.replace(/[%\s]/g, "").replace(/[.,]/g, ""))
    .filter((digits) => digits.length > 0)
    // A year already in the CV, a team size already written down: supported.
    .filter((digits) => !haystack.includes(digits));

  return [...new Set(unsupported)];
}

/** Technologies named in the proposed text that the CV never mentions. */
export function unsupportedSkills(suggested: string, resumeAll: string): string[] {
  const haystack = normalize(resumeAll);
  return detectStack(suggested).filter((tag) => !containsTerm(haystack, tag));
}

/**
 * Reads every suggestion back against the document.
 *
 * Also the place where an address that no longer resolves is dropped: a
 * recommendation for a bullet the person deleted while the model was thinking
 * must not reappear pointing at whatever took its place.
 */
export function groundSuggestions(
  resume: Resume,
  suggestions: ResumeSuggestion[],
): GroundingResult {
  const text = resumeText(resume);
  const out: ResumeSuggestion[] = [];
  let dropped = 0;
  let stripped = 0;

  for (const suggestion of suggestions) {
    const target = toTarget(suggestion);
    const element = target ? resolveTarget(resume, target) : null;
    if (!element) {
      dropped += 1;
      continue;
    }

    // The document is the authority on what it currently says, never the model.
    const current: ResumeSuggestion = { ...suggestion, currentText: element.text };

    const proposed = current.suggestedText?.trim();
    if (!proposed) {
      out.push({ ...current, suggestedText: undefined });
      continue;
    }

    if (proposed === element.text.trim()) {
      // A rewrite identical to what is already there is not a recommendation.
      dropped += 1;
      continue;
    }

    const numbers = unsupportedNumbers(proposed, [element.text, text.all]);
    const skills = unsupportedSkills(proposed, text.all);

    if (numbers.length === 0 && skills.length === 0) {
      out.push(current);
      continue;
    }

    stripped += 1;
    out.push({
      ...current,
      suggestedText: undefined,
      type: skills.length > 0 ? "missing_requirement" : "missing_evidence",
      requiresConfirmation: true,
      reason:
        skills.length > 0
          ? `${skills.join(", ")} ${skills.length > 1 ? "are" : "is"} asked for by the advert but ${skills.length > 1 ? "do" : "does"} not appear anywhere in your CV, so there is no version of this line that can claim it. Add it yourself only if you have genuinely worked with it.`
          : "This line would be much stronger with a result attached, and the CV does not record one. Add the real figure if you have it — a number that cannot be defended is worse than no number.",
    });
  }

  return { suggestions: out, dropped, stripped };
}
