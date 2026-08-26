import { z } from "zod";

import { containsTerm, normalize } from "@/lib/tailoring/match";
import { unsupportedSkills } from "@/lib/tailoring/safety";

import { resumeId, resumeSchema, type Resume } from "./schema";
import { resumeElements, type ResumeElement } from "./target";

/**
 * A CV read out of a document, turned into the document model — and checked
 * back against the text it came from.
 *
 * Importing and tailoring are different jobs and this module only does the
 * first one. The question here is "what does this CV currently say?", never
 * "how could it be better?". Nothing is rewritten, tidied, translated or
 * completed on the way in: a bullet that reads badly is imported reading badly,
 * because the person is about to see it beside the original and has to
 * recognise it.
 *
 * The check at the end is the same idea as `tailoring/safety.ts`, pointed at a
 * different risk. There, a model was asked to write and must not invent. Here a
 * model is asked only to classify — so anything it returns that is not in the
 * source text is, by definition, invented, and this is where that is caught.
 */

export type ImportWarningCode =
  | "scanned"
  | "no-model"
  | "two-columns"
  | "unclassified"
  | "uncertain-fields"
  | "dropped-content"
  | "short-text";

export type ResumeImportWarning = { code: ImportWarningCode; message: string };

/** Text found in the document that could not be placed. Never thrown away. */
export type UnclassifiedContent = { id: string; text: string; sourcePage?: number };

export type ResumeImportResult = {
  resume: Resume;
  warnings: ResumeImportWarning[];
  unclassifiedContent: UnclassifiedContent[];
  /** Element keys worth a second look before this is confirmed. */
  uncertain: string[];
  requiresReview: boolean;
  source: "model" | "heuristic";
};

/* -------------------------------------------------------------------------- */

const line = z.string().trim().max(200).nullable().default(null);
const body = z.string().max(1_500).nullable().default(null);

/**
 * What the model may return.
 *
 * No ids: they are minted here, so that two runs cannot collide and so that a
 * model cannot point one entry at another's identity. Dates are nullable
 * because an unreadable date has to be expressible as unread rather than as a
 * guess, and `needsReview` exists so that a model which is unsure can say so
 * instead of rounding its uncertainty away.
 */
const importedExperience = z.object({
  company: line,
  role: line,
  startDate: line,
  endDate: line,
  /** "Present", "Current", "Atual" — the end date that is not a date. */
  current: z.boolean().default(false),
  location: line,
  bullets: z.array(z.string().max(1_500)).max(40).default([]),
  needsReview: z.boolean().default(false),
});

const importedEducation = z.object({
  institution: line,
  degree: line,
  startDate: line,
  endDate: line,
  location: line,
  details: body,
  needsReview: z.boolean().default(false),
});

const importedSkillGroup = z.object({
  name: line,
  skills: z.array(z.string().trim().max(80)).max(80).default([]),
});

const importedProject = z.object({
  name: line,
  role: line,
  link: line,
  bullets: z.array(z.string().max(1_500)).max(20).default([]),
});

export const modelImportSchema = z.object({
  resume: z.object({
    personalInfo: z
      .object({
        fullName: line,
        headline: line,
        email: line,
        phone: line,
        location: line,
        links: z.array(z.string().trim().max(200)).max(10).default([]),
      })
      .default(() => ({
        fullName: null,
        headline: null,
        email: null,
        phone: null,
        location: null,
        links: [],
      })),
    summary: z
      .object({ text: body, needsReview: z.boolean().default(false) })
      .default(() => ({ text: null, needsReview: false })),
    experience: z.array(importedExperience).max(40).default([]),
    education: z.array(importedEducation).max(20).default([]),
    skills: z.array(importedSkillGroup).max(20).default([]),
    projects: z.array(importedProject).max(20).default([]),
    languages: z
      .array(z.object({ name: line, level: line }))
      .max(20)
      .default([]),
    certifications: z
      .array(z.object({ name: line, issuer: line, year: line }))
      .max(20)
      .default([]),
  }),
  warnings: z.array(z.string().trim().max(240)).max(10).default([]),
  unclassifiedContent: z
    .array(
      z.object({
        text: z.string().trim().max(2_000),
        sourcePage: z.number().int().min(1).max(99).optional(),
      }),
    )
    .max(20)
    .default([]),
});

export type ModelImport = z.output<typeof modelImportSchema>;

/**
 * The stored form of a reading awaiting review.
 *
 * Validated on the way out of the database as well as on the way in: a row
 * written by an older version of this schema must not reach the review screen
 * as an unchecked shape.
 */
export const importResultSchema = z.object({
  resume: resumeSchema,
  warnings: z
    .array(
      z.object({
        code: z.enum([
          "scanned",
          "no-model",
          "two-columns",
          "unclassified",
          "uncertain-fields",
          "dropped-content",
          "short-text",
        ]),
        message: z.string().max(400),
      }),
    )
    .default([]),
  unclassifiedContent: z
    .array(
      z.object({
        id: z.string().max(64),
        text: z.string().max(2_000),
        sourcePage: z.number().int().optional(),
      }),
    )
    .default([]),
  uncertain: z.array(z.string().max(200)).default([]),
  requiresReview: z.boolean().default(true),
  source: z.enum(["model", "heuristic"]).default("heuristic"),
});

/* -------------------------------------------------------------------------- */

const value = (input: string | null | undefined) => (input ?? "").trim();

/**
 * The model's reading, given ids and the shape the editor writes through.
 *
 * Order is preserved exactly as it arrived, which is the order the document was
 * written in: a CV that leads with education is making a point by doing so, and
 * sorting it into a house order would erase that.
 */
export function toResume(parsed: ModelImport): { resume: Resume; uncertain: string[] } {
  const uncertain: string[] = [];
  const source = parsed.resume;

  const experience = source.experience.map((item) => {
    const id = resumeId("exp");
    if (item.needsReview) uncertain.push(`experience/${id}/role`);
    return {
      id,
      company: value(item.company),
      role: value(item.role),
      startDate: value(item.startDate),
      // A role still being done has no end date, and saying "Present" is the
      // document's own way of saying so rather than a date this invented.
      endDate: item.current ? "Present" : value(item.endDate),
      current: item.current,
      location: value(item.location),
      bullets: item.bullets
        .map((text) => text.trim())
        .filter(Boolean)
        .map((text) => ({ id: resumeId("bul"), text })),
    };
  });

  const education = source.education.map((item) => {
    const id = resumeId("edu");
    if (item.needsReview) uncertain.push(`education/${id}/degree`);
    return {
      id,
      institution: value(item.institution),
      degree: value(item.degree),
      startDate: value(item.startDate),
      endDate: value(item.endDate),
      location: value(item.location),
      details: value(item.details),
    };
  });

  const resume = resumeSchema.parse({
    personal: {
      fullName: value(source.personalInfo.fullName),
      headline: value(source.personalInfo.headline),
      email: value(source.personalInfo.email),
      phone: value(source.personalInfo.phone),
      location: value(source.personalInfo.location),
      links: source.personalInfo.links.map((link) => link.trim()).filter(Boolean),
    },
    summary: { text: value(source.summary.text) },
    experience,
    education,
    skills: source.skills.map((group) => ({
      id: resumeId("skl"),
      name: value(group.name),
      skills: group.skills.map((skill) => skill.trim()).filter(Boolean),
    })),
    projects: source.projects.map((project) => ({
      id: resumeId("prj"),
      name: value(project.name),
      role: value(project.role),
      link: value(project.link),
      bullets: project.bullets
        .map((text) => text.trim())
        .filter(Boolean)
        .map((text) => ({ id: resumeId("bul"), text })),
    })),
    languages: source.languages.map((language) => ({
      id: resumeId("lng"),
      name: value(language.name),
      level: value(language.level),
    })),
    certifications: source.certifications.map((certification) => ({
      id: resumeId("crt"),
      name: value(certification.name),
      issuer: value(certification.issuer),
      year: value(certification.year),
    })),
  });

  if (source.summary.needsReview) uncertain.push("summary/text");

  return { resume, uncertain };
}

/* -------------------------------------------------------------------------- */

/** Below this share of its words present in the source, a passage was not read out of it. */
const KEEP_THRESHOLD = 0.4;
/** Below this share, it is kept but flagged: extraction loses characters too. */
const REVIEW_THRESHOLD = 0.75;

/** Fields whose value is short enough that it either appears in the source or was invented. */
const ATOMIC = new Set([
  "fullName",
  "headline",
  "email",
  "phone",
  "location",
  "role",
  "company",
  "institution",
  "degree",
  "level",
  "name",
  "issuer",
  "year",
]);

/**
 * How much of a passage can be found in the document it came from.
 *
 * Word by word rather than as a whole string, because extraction is lossy in
 * ways that do not change meaning: a ligature becomes two letters, a soft
 * hyphen disappears, a line break becomes a space.
 */
export function support(passage: string, source: string): number {
  const words = normalize(passage)
    .split(" ")
    .filter((word) => word.length > 2);
  if (words.length === 0) return 1;

  const found = words.filter((word) => source.includes(` ${word}`) || source.includes(`${word} `));
  return found.length / words.length;
}

export type GroundingOutcome = {
  resume: Resume;
  uncertain: string[];
  /** How many values were removed for having no support in the document. */
  removed: number;
};

/**
 * Every imported value, read back against the text of the document.
 *
 * Three outcomes, and the middle one is the reason this is not a simple filter:
 *
 *   · a short field that is not in the source is removed — a phone number the
 *     document does not contain is a fabricated phone number, and there is no
 *     reading under which it is a lossy extraction of something real;
 *   · a passage that is mostly absent is removed, because a bullet nobody
 *     wrote is worse than a bullet missing;
 *   · a passage that is mostly present is kept and flagged, because extraction
 *     drops characters and deleting somebody's real work over a lost ligature
 *     would be the worse error.
 */
export function groundImportedResume(resume: Resume, sourceText: string): GroundingOutcome {
  const source = normalize(sourceText);
  const uncertain: string[] = [];
  let removed = 0;
  let current = resume;

  const keys = resumeElements(resume).map((element) => element.key);

  for (const key of keys) {
    const element: ResumeElement | undefined = resumeElements(current).find(
      (candidate) => candidate.key === key,
    );
    if (!element || !element.text.trim()) continue;

    // A skills line is a list of claims, and each one stands or falls alone.
    if (element.target.sectionId === "skills" && !element.target.fieldId) {
      const skills = element.text
        .split(",")
        .map((skill) => skill.trim())
        .filter(Boolean);
      const kept = skills.filter((skill) => containsTerm(source, skill));
      if (kept.length !== skills.length) {
        removed += skills.length - kept.length;
        current = element.write(kept.join(", "));
      }
      continue;
    }

    const field = element.target.fieldId ?? "";
    const atomic = ATOMIC.has(field) || element.target.sectionId === "personal";

    if (atomic) {
      const present = support(element.text, source) >= REVIEW_THRESHOLD;
      if (!present) {
        removed += 1;
        current = element.write("");
      }
      continue;
    }

    const share = support(element.text, source);
    if (share < KEEP_THRESHOLD) {
      removed += 1;
      current = element.write("");
      continue;
    }

    /**
     * A technology named in a passage that the document never mentions is a
     * claim nobody made, even when the rest of the sentence is real — one word
     * out of eight barely moves the share above, and "and Redux" is exactly the
     * shape of that failure.
     *
     * Flagged rather than deleted: the sentence around it is the person's own
     * work, and taking it away to remove one word would cost more than it
     * saves. The review screen marks the field, so nothing reaches the CV
     * without having been looked at.
     */
    const invented = unsupportedSkills(element.text, sourceText);
    if (share < REVIEW_THRESHOLD || invented.length > 0) uncertain.push(key);
  }

  return { resume: current, uncertain, removed };
}

/** Text the reader has not placed anywhere, given ids so the interface can list it. */
export function toUnclassified(
  items: ReadonlyArray<{ text: string; sourcePage?: number }>,
): UnclassifiedContent[] {
  return items
    .map((item) => ({ id: resumeId("unc"), text: item.text.trim(), sourcePage: item.sourcePage }))
    .filter((item) => item.text.length > 0);
}
