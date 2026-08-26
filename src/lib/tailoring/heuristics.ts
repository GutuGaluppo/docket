import { TECHNOLOGIES, detectStack } from "@/lib/stack-detector";

import { STOP_WORDS, containsTerm, keyTerms, normalize } from "./match";
import type {
  JobAnalysis,
  JobKeyword,
  JobRequirement,
  RequirementImportance,
  RequirementKind,
} from "./types";

/**
 * Reading a job advert without asking anything of a model.
 *
 * Two reasons this exists rather than the analysis being a single model call.
 * The first is that the product has to work when no key is configured — the
 * whole editor, the score and the gap list are usable on the deterministic
 * reading alone. The second is that it is the floor: whatever the model returns
 * is merged on top of this, so a model that answers with nothing still leaves a
 * reading behind, and a model that answers with something wrong is measured
 * against a reading that came from the advert's own words.
 *
 * What it can do: find named technologies, tell a "must have" block from a
 * "nice to have" one, count what the advert keeps repeating, and pick out the
 * lines that describe the work. What it cannot do: paraphrase, judge tone, or
 * rewrite a bullet. Those need the model, and nothing here pretends otherwise.
 */

const REQUIRED_HEADINGS =
  /\b(requirements?|must[- ]have|what you (?:bring|need)|qualifications?|we expect|your profile|anforderungen)\b/i;
const PREFERRED_HEADINGS =
  /\b(nice[- ]to[- ]have|preferred|bonus|a plus|desirable|would be great|optional|wünschenswert)\b/i;
const RESPONSIBILITY_HEADINGS =
  /\b(responsibilit(?:y|ies)|what you(?:'|’)?ll do|your (?:role|tasks|mission)|the job|day[- ]to[- ]day|aufgaben)\b/i;

type LineKind = "required" | "preferred" | "responsibility" | "body";

type Line = { text: string; normalized: string; kind: LineKind };

/**
 * The advert, line by line, each one carrying the heading it sits under.
 *
 * Adverts are written as blocks with titles, and the title is the only place
 * that says whether the list below it is mandatory. Carrying the heading
 * forward is what lets a single mention of Kubernetes under "nice to have" be
 * scored as optional rather than as a hard requirement the CV is failing.
 */
function readLines(text: string): Line[] {
  let kind: LineKind = "body";

  return text.split(/\r?\n/).map((raw) => {
    const line = raw.trim();
    if (line && line.length <= 120) {
      if (REQUIRED_HEADINGS.test(line)) kind = "required";
      else if (PREFERRED_HEADINGS.test(line)) kind = "preferred";
      else if (RESPONSIBILITY_HEADINGS.test(line)) kind = "responsibility";
    }
    if (!line) kind = kind === "body" ? "body" : kind;
    return { text: line, normalized: normalize(line), kind };
  });
}

const BULLET = /^[-•*·–—▪]\s*|^\d+[.)]\s*/;

const isBullet = (line: Line) => BULLET.test(line.text);
const stripBullet = (line: string) => line.replace(BULLET, "").trim();

function requirementId(prefix: string, index: number): string {
  return `${prefix}-${index}`;
}

/* -------------------------------------------------------------------------- */

/** The advert's own title, when it opens with one. */
function readRoleTitle(lines: Line[]): string {
  const labelled = lines.find((line) => /^(job title|position|role)\s*[:\-]/i.test(line.text));
  if (labelled) return labelled.text.split(/[:\-]/).slice(1).join(" ").trim().slice(0, 120);

  const first = lines.find((line) => line.text.length > 2);
  if (!first) return "";
  // A heading is short and has no full stop. A paragraph is neither.
  if (first.text.length > 90 || /[.!?]\s/.test(first.text)) return "";
  return first.text.replace(BULLET, "").trim().slice(0, 120);
}

const SENIORITY = /\b(intern|junior|mid[- ]level|senior|staff|principal|lead|head of|director)\b/i;

function readSeniority(text: string): string {
  const found = text.match(SENIORITY);
  return found ? found[0].toLowerCase() : "";
}

const DOMAINS = [
  "fintech",
  "healthtech",
  "e-commerce",
  "ecommerce",
  "gaming",
  "music",
  "saas",
  "b2b",
  "b2c",
  "edtech",
  "logistics",
  "travel",
  "adtech",
  "cybersecurity",
  "marketplace",
  "media",
  "banking",
  "insurance",
  "mobility",
  "energy",
  "retail",
  "artificial intelligence",
  "machine learning",
];

function readDomain(normalized: string): string {
  return DOMAINS.find((domain) => containsTerm(normalized, domain)) ?? "";
}

/* -------------------------------------------------------------------------- */

/**
 * Named technologies, weighted by where the advert names them.
 *
 * A tag mentioned twice, or mentioned under a requirements heading, is being
 * asked for. One that only ever appears under "nice to have" is exactly that,
 * and section 5 forbids scoring it as a failure.
 */
function readSkills(
  text: string,
  lines: Line[],
): { required: JobRequirement[]; preferred: JobRequirement[] } {
  const tags = detectStack(text);
  const required: JobRequirement[] = [];
  const preferred: JobRequirement[] = [];

  tags.forEach((tag, position) => {
    const aliases = TECHNOLOGIES[tag] ?? [];
    const terms = [tag, ...aliases];
    const mentions = lines.filter((line) =>
      terms.some((term) => containsTerm(line.normalized, term)),
    );

    const kinds = new Set(mentions.map((line) => line.kind));
    const onlyOptional = kinds.size > 0 && kinds.has("preferred") && !kinds.has("required");

    const importance: RequirementImportance = onlyOptional
      ? "preferred"
      : kinds.has("required") || mentions.length > 1
        ? "required"
        : "important";

    const requirement: JobRequirement = {
      id: requirementId("skill", position),
      text: tag,
      importance,
      kind: "skill",
      terms,
    };

    if (importance === "preferred") preferred.push(requirement);
    else required.push(requirement);
  });

  return { required, preferred };
}

/**
 * The lines that describe the work rather than the candidate.
 *
 * Lines that state a length of experience are left out: they are already
 * collected as qualifications, and a requirement counted twice is a requirement
 * weighted twice.
 */
function readResponsibilities(lines: Line[]): JobRequirement[] {
  const candidates = lines.filter(
    (line) =>
      line.text.length >= 25 &&
      line.text.length <= 320 &&
      !YEARS.test(line.text) &&
      (isBullet(line) || line.kind === "responsibility"),
  );

  const chosen = candidates.filter((line) => line.kind !== "preferred").slice(0, 10);

  return chosen.map((line, position) => ({
    id: requirementId("resp", position),
    text: stripBullet(line.text),
    importance: line.kind === "required" ? "required" : "important",
    kind: "responsibility" as RequirementKind,
    terms: keyTerms(line.text).slice(0, 6),
  }));
}

const YEARS = /(\d+)\s*\+?\s*(?:-\s*\d+\s*)?(?:years?|yrs?|jahre)/i;

/** "5+ years of frontend engineering" and the like. */
function readExperienceRequirements(lines: Line[]): JobRequirement[] {
  return lines
    .filter((line) => YEARS.test(line.text) && line.text.length <= 240)
    .slice(0, 4)
    .map((line, position) => ({
      id: requirementId("exp", position),
      text: stripBullet(line.text),
      importance: line.kind === "preferred" ? "preferred" : "required",
      kind: "qualification" as RequirementKind,
      terms: keyTerms(line.text).slice(0, 6),
    }));
}

/**
 * What the advert keeps coming back to.
 *
 * Frequency is the advert's own emphasis, so it is the whole ranking: a word
 * written five times is what the role is about, and a word written once is
 * context. Technologies are excluded because they are already requirements —
 * counting them twice would let a CV score well on keywords for the same
 * evidence that scored it well on skills.
 */
function readKeywords(text: string, skills: JobRequirement[]): JobKeyword[] {
  const claimed = new Set(skills.flatMap((skill) => skill.terms.map((term) => term.toLowerCase())));
  const counts = new Map<string, number>();

  const words = normalize(text).split(" ").filter(Boolean);
  for (const word of words) {
    const term = word.replace(/^[.\-]+|[.\-]+$/g, "");
    if (term.length < 4 || STOP_WORDS.has(term) || claimed.has(term)) continue;
    if (/^\d/.test(term)) continue;
    counts.set(term, (counts.get(term) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 14)
    .map(([term, occurrences], position) => ({
      id: requirementId("kw", position),
      text: term,
      // Said three times or more, the advert is insisting.
      weight: occurrences >= 3 ? "primary" : "secondary",
      occurrences,
    }));
}

/**
 * The advert, structured. Deterministic: the same text always reads the same
 * way, which is what lets the tests hold it in place.
 */
export function readJobDescription(text: string): JobAnalysis {
  const lines = readLines(text);
  const normalized = normalize(text);
  const skills = readSkills(text, lines);

  return {
    roleTitle: readRoleTitle(lines),
    requiredSkills: skills.required,
    preferredSkills: skills.preferred,
    responsibilities: readResponsibilities(lines),
    experienceRequirements: readExperienceRequirements(lines),
    keywords: readKeywords(text, [...skills.required, ...skills.preferred]),
    inferredSeniority: readSeniority(text),
    domain: readDomain(normalized),
  };
}

/** Whether there is enough advert to read. */
export function hasJobContent(text: string): boolean {
  return text.replace(/\s+/g, "").length >= 120;
}
