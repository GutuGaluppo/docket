import { detectStack } from "@/lib/stack-detector";
import type { Resume } from "@/lib/resume/schema";
import {
  resumeElements,
  targetKey,
  type ResumeElement,
  type ResumeTarget,
} from "@/lib/resume/target";

import { requirementsOf } from "./coverage";
import type {
  CoverageReport,
  JobAnalysis,
  JobRequirement,
  ResumeSuggestion,
  SuggestionPriority,
} from "./types";

/**
 * The recommendations that can be made without writing a word of new prose.
 *
 * Everything here is a statement about what is or is not in the document — a
 * requirement with no evidence, a claim with no example, a bullet that opens
 * with a hedge — and none of it carries a rewrite. That is the deliberate line:
 * a deterministic reading can point at a gap truthfully, but it cannot phrase
 * someone's experience for them, and inventing a phrasing is exactly the
 * failure the whole feature is built to avoid. Rewrites come from the model,
 * and even those are checked before they are offered (see `safety.ts`).
 *
 * A suggestion without `suggestedText` is still actionable: the reader edits
 * the field, or opens Edit and writes their own version, and the score is
 * recomputed from what they actually wrote.
 */

type Input = { resume: Resume; analysis: JobAnalysis; coverage: CoverageReport };

const HEDGES = [
  "worked on",
  "responsible for",
  "was responsible for",
  "helped with",
  "helped to",
  "assisted with",
  "participated in",
  "involved in",
  "was part of",
  "took part in",
];

/** Bullets longer than this are where an ATS and a reader both start skimming. */
const LONG_BULLET = 320;

/** Titles are read at a glance down a column; a sentence in one is unreadable. */
function headline(text: string, max = 68): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 20 ? cut.lastIndexOf(" ") : max)}…`;
}

function target(
  element: ResumeElement,
): Pick<ResumeSuggestion, "targetSectionId" | "targetEntryId" | "targetFieldId" | "targetItemId"> {
  return {
    targetSectionId: element.target.sectionId,
    targetEntryId: element.target.entryId,
    targetFieldId: element.target.fieldId,
    targetItemId: element.target.itemId,
  };
}

function sectionTarget(sectionId: ResumeTarget["sectionId"]) {
  return { targetSectionId: sectionId };
}

/** The first bullet of the most recent role — where evidence for a skill belongs. */
function firstExperienceBullet(elements: ResumeElement[]): ResumeElement | null {
  return (
    elements.find(
      (element) => element.target.sectionId === "experience" && element.target.itemId,
    ) ?? null
  );
}

function priorityOf(requirement: JobRequirement): SuggestionPriority {
  if (requirement.importance === "required") return "high";
  if (requirement.importance === "important") return "medium";
  return "low";
}

/**
 * Gaps, claims and readability, read off the coverage report.
 *
 * The order they are produced in does not matter — `sortSuggestions` decides
 * what the reader sees first — but the ids do: they are derived from the
 * position in this list so that the same CV and the same advert produce the
 * same recommendation under the same id twice running.
 */
export function gapSuggestions({ resume, analysis, coverage }: Input): ResumeSuggestion[] {
  const elements = resumeElements(resume);
  const byStatus = new Map(
    coverage.requirements.map((entry) => [entry.requirementId, entry.status]),
  );
  const requirements = requirementsOf(analysis);
  const out: Omit<ResumeSuggestion, "id">[] = [];

  const skillsTarget = elements.find((element) => element.target.sectionId === "skills");
  const summaryTarget = elements.find((element) => element.target.sectionId === "summary");
  const bulletTarget = firstExperienceBullet(elements);

  /* Requirements with nothing behind them ----------------------------------- */
  /**
   * An advert says the same thing twice — once as "GraphQL" in a skills list
   * and once as "Experience with GraphQL APIs" in a sentence — and both read as
   * missing. The reader should be told once. The named technology wins, because
   * it is the shorter and more actionable of the two.
   */
  const namedGaps = new Set<string>();

  for (const requirement of requirements) {
    const status = byStatus.get(requirement.id) ?? "missing";
    if (status !== "missing") continue;
    if (requirement.importance === "preferred" && requirement.kind !== "skill") continue;

    const isSkill = requirement.kind === "skill";
    if (isSkill) {
      namedGaps.add(requirement.text.toLowerCase());
    } else if (detectStack(requirement.text).some((tag) => namedGaps.has(tag.toLowerCase()))) {
      continue;
    }

    const optional = requirement.importance === "preferred";
    out.push({
      ...(isSkill && skillsTarget
        ? target(skillsTarget)
        : sectionTarget(isSkill ? "skills" : "experience")),
      type: "missing_requirement",
      priority: priorityOf(requirement),
      title: optional
        ? `${headline(requirement.text)} is a nice-to-have you do not list`
        : `${headline(requirement.text)} is asked for and does not appear`,
      reason: isSkill
        ? `The advert names ${requirement.text}, and nothing in the CV mentions it. Add it only if you genuinely have this experience — a requirement you do not meet is a gap to know about, not a line to write.`
        : `Nothing in the CV answers this line of the advert: “${requirement.text}”. If you have done this work, it is not visible yet; if you have not, this is a gap to go in knowing about.`,
      relatedKeywords: isSkill ? [requirement.text] : undefined,
      affects: isSkill ? ["skillsMatch", "keywordCoverage"] : ["experienceRelevance"],
      requiresConfirmation: true,
      source: "heuristic",
      status: "pending",
    });
  }

  /* Skills claimed in a list but never shown in the work --------------------- */
  for (const requirement of requirements) {
    if (requirement.kind !== "skill") continue;
    if ((byStatus.get(requirement.id) ?? "missing") !== "partial") continue;

    const anchor = bulletTarget;
    out.push({
      ...(anchor ? target(anchor) : sectionTarget("experience")),
      type: "skill_alignment",
      priority: requirement.importance === "required" ? "high" : "medium",
      title: `${headline(requirement.text)} is listed but never shown`,
      reason: `${requirement.text} appears in your skills but in none of the roles. Where you actually used it, saying so in that role turns a claim into evidence.`,
      currentText: anchor?.text,
      relatedKeywords: [requirement.text],
      affects: ["skillsMatch", "experienceRelevance"],
      requiresConfirmation: true,
      source: "heuristic",
      status: "pending",
    });
  }

  /* Terms the advert insists on ---------------------------------------------- */
  const covered = new Set(coverage.keywords);
  const missingPrimary = analysis.keywords
    .filter((keyword) => keyword.weight === "primary" && !covered.has(keyword.id))
    .slice(0, 4);

  for (const keyword of missingPrimary) {
    out.push({
      ...(summaryTarget ? target(summaryTarget) : sectionTarget("summary")),
      type: "missing_keyword",
      priority: "medium",
      title: `“${keyword.text}” is repeated in the advert and missing here`,
      reason: `The advert uses “${keyword.text}” ${keyword.occurrences} times. If it describes work you have done, using the same word once — in the summary or in the role where it applies — makes the CV answer the advert in its own vocabulary. Repeating it beyond that helps nobody.`,
      currentText: summaryTarget?.text,
      relatedKeywords: [keyword.text],
      affects: ["keywordCoverage"],
      requiresConfirmation: true,
      source: "heuristic",
      status: "pending",
    });
  }

  /* Wording ------------------------------------------------------------------ */
  for (const element of elements) {
    if (!element.target.itemId || !element.text.trim()) continue;
    const opening = element.text.toLowerCase().trimStart();
    const hedge = HEDGES.find((phrase) => opening.startsWith(phrase));
    if (!hedge) continue;

    out.push({
      ...target(element),
      type: "weak_wording",
      priority: "medium",
      title: `“${hedge}” opens this bullet`,
      reason: `Opening with “${hedge}” describes involvement rather than what was done. Lead with the action itself and keep the same facts — Edit lets you write the version you would defend in an interview.`,
      currentText: element.text,
      affects: ["experienceRelevance"],
      requiresConfirmation: false,
      source: "heuristic",
      status: "pending",
    });
  }

  /* Evidence ----------------------------------------------------------------- */
  for (const element of elements) {
    if (!element.target.itemId) continue;
    const words = element.text.trim().split(/\s+/).filter(Boolean);
    if (words.length < 10 || /\d/.test(element.text)) continue;

    out.push({
      ...target(element),
      type: "missing_evidence",
      priority: "low",
      title: "This bullet describes work without an outcome",
      reason:
        "There is no scale, duration or result here to tell the reader how much this was. If you have a measurable one, adding it is the single strongest edit on the page. If you do not, leave it — an invented number is worse than none.",
      currentText: element.text,
      affects: ["experienceRelevance"],
      requiresConfirmation: true,
      source: "heuristic",
      status: "pending",
    });
  }

  /* Readability -------------------------------------------------------------- */
  for (const element of elements) {
    if (element.text.length <= LONG_BULLET) continue;
    out.push({
      ...target(element),
      type: "ats_readability",
      priority: "low",
      title: "This block runs long enough to be skimmed past",
      reason: `At ${element.text.length} characters this is a paragraph rather than a bullet. Splitting it into two lines keeps every claim readable by a person and extractable by a parser.`,
      currentText: element.text,
      affects: [],
      requiresConfirmation: false,
      source: "heuristic",
      status: "pending",
    });
  }

  if (!resume.summary.text.trim() && analysis.roleTitle) {
    out.push({
      ...sectionTarget("summary"),
      type: "summary_alignment",
      priority: "high",
      title: "There is no summary to place you against this role",
      reason: `The advert is for ${analysis.roleTitle}. Two or three lines at the top saying what you do — in the terms this advert uses, and only where they are true of you — is what a reader sees first.`,
      affects: ["roleAlignment", "keywordCoverage"],
      requiresConfirmation: false,
      source: "heuristic",
      status: "pending",
    });
  }

  return out.map((suggestion, position) => ({ ...suggestion, id: `h-${position + 1}` }));
}

/** The address a suggestion points at, flattened — the key the editor renders. */
export function suggestionTargetKey(suggestion: ResumeSuggestion): string {
  return targetKey({
    sectionId: suggestion.targetSectionId,
    entryId: suggestion.targetEntryId,
    fieldId: suggestion.targetFieldId,
    itemId: suggestion.targetItemId,
  });
}
