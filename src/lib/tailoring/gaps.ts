import type { Resume } from "@/lib/resume/schema";
import {
  resumeElements,
  targetKey,
  type ResumeElement,
  type ResumeTarget,
} from "@/lib/resume/target";

import type {
  CoverageReport,
  JobAnalysis,
  JobMatchDimension,
  JobRequirement,
  RequirementCategory,
  ResumeSuggestion,
  SuggestionPriority,
} from "./types";

/**
 * The recommendations that follow from the comparison itself.
 *
 * Every gap here is a requirement the scoring already counted as unanswered, so
 * the panel and the figure cannot contradict each other: a Skills Match of 95%
 * beside "you are missing almost every core skill" is not a wording problem, it
 * is two different analyses being shown at once. There is one analysis, and
 * this reads it.
 *
 * Nothing here carries a rewrite. A deterministic pass can point at a gap
 * truthfully and cannot phrase someone's experience for them; the model's
 * recommendations arrive separately and are checked before they are offered
 * (see `safety.ts`).
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

function target(element: ResumeElement) {
  return {
    targetSectionId: element.target.sectionId,
    targetEntryId: element.target.entryId,
    targetFieldId: element.target.fieldId,
    targetItemId: element.target.itemId,
  };
}

const sectionTarget = (sectionId: ResumeTarget["sectionId"]) => ({ targetSectionId: sectionId });

const priorityOf = (requirement: JobRequirement): SuggestionPriority =>
  requirement.importance === "required"
    ? "high"
    : requirement.importance === "important"
      ? "medium"
      : "low";

/** Which dimension a requirement scores in — the same table `score.ts` uses. */
const DIMENSION_OF: Record<RequirementCategory, JobMatchDimension> = {
  skill: "skillsMatch",
  tool: "skillsMatch",
  practice: "skillsMatch",
  experience: "experienceRelevance",
  responsibility: "experienceRelevance",
  domain: "experienceRelevance",
  soft_skill: "roleAlignment",
};

const LISTABLE = new Set<RequirementCategory>(["skill", "tool", "practice"]);

export function gapSuggestions({ resume, analysis, coverage }: Input): ResumeSuggestion[] {
  const elements = resumeElements(resume);
  const verdicts = new Map(coverage.requirements.map((entry) => [entry.requirementId, entry]));
  const out: Omit<ResumeSuggestion, "id">[] = [];

  const skillsTarget = elements.find((element) => element.target.sectionId === "skills");
  const summaryTarget = elements.find((element) => element.target.sectionId === "summary");
  const firstBullet = elements.find(
    (element) => element.target.sectionId === "experience" && element.target.itemId,
  );

  /* Requirements with nothing behind them ----------------------------------- */
  for (const requirement of analysis.requirements) {
    const verdict = verdicts.get(requirement.id);
    if (verdict?.match !== "missing") continue;

    const listable = LISTABLE.has(requirement.category);
    const anchor = listable ? skillsTarget : firstBullet;

    out.push({
      ...(anchor ? target(anchor) : sectionTarget(listable ? "skills" : "experience")),
      type: "missing_requirement",
      priority: priorityOf(requirement),
      title:
        requirement.importance === "preferred"
          ? `${headline(requirement.name)} is a nice-to-have you do not list`
          : `${headline(requirement.name)} is asked for and does not appear`,
      reason:
        `The advert asks for this: “${headline(requirement.sourceText || requirement.name, 140)}”. ` +
        "Nothing in the CV evidences it. Add it only if you genuinely have this experience — a requirement you do not meet is a gap to know about, not a line to write.",
      relatedKeywords: [requirement.name],
      requirementId: requirement.id,
      affects: [DIMENSION_OF[requirement.category]],
      requiresConfirmation: true,
      source: "heuristic",
      status: "pending",
    });
  }

  /* Requirements answered somewhere weaker than the work itself -------------- */
  for (const requirement of analysis.requirements) {
    const verdict = verdicts.get(requirement.id);
    if (verdict?.match !== "partial") continue;

    const seen = verdict.evidence[0];
    const anchor =
      elements.find((element) => element.key === seen?.key) ?? firstBullet ?? skillsTarget;

    out.push({
      ...(anchor ? target(anchor) : sectionTarget("experience")),
      type: "skill_alignment",
      priority: requirement.importance === "required" ? "high" : "medium",
      title: `${headline(requirement.name)} is mentioned but not shown`,
      reason: seen
        ? `${requirement.name} appears in your ${seen.source} section, but not inside the work itself. Where you actually did it, saying so in that role turns a claim into evidence.`
        : `${requirement.name} is mentioned somewhere that does not read as evidence of doing the work.`,
      currentText: anchor?.text,
      relatedKeywords: [requirement.name],
      requirementId: requirement.id,
      affects: [DIMENSION_OF[requirement.category]],
      requiresConfirmation: true,
      source: "heuristic",
      status: "pending",
    });
  }

  /* Terms the advert leans on ------------------------------------------------ */
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
