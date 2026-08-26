import { z } from "zod";

/**
 * The CV as data, never as a blob of HTML.
 *
 * Everything the analysis points at has to be addressable — "the second bullet
 * of the Loudly entry", not "somewhere in the experience section" — and a
 * string of markup cannot be addressed. So the document is a tree of small
 * records, each carrying an id that outlives every edit made to its text.
 *
 * The ids are what the suggestions travel with. Regenerating one silently
 * detaches every recommendation aimed at it, which is why nothing in this
 * module ever rewrites an id: `blankResume` and the parser mint them once, and
 * from then on only the text around them changes.
 */

const line = (max: number) => z.string().trim().max(max);
/** Body text keeps its line breaks; only the ends are trimmed. */
const body = (max: number) => z.string().max(max);

export const SECTION_IDS = [
  "personal",
  "summary",
  "experience",
  "education",
  "skills",
  "projects",
  "languages",
  "certifications",
] as const;

export type ResumeSectionId = (typeof SECTION_IDS)[number];

/** What each section is called wherever a suggestion names its target. */
export const SECTION_LABELS: Record<ResumeSectionId, string> = {
  personal: "Personal information",
  summary: "Professional summary",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
  projects: "Projects",
  languages: "Languages",
  certifications: "Certifications",
};

export const resumeBulletSchema = z.object({
  id: z.string().min(1).max(64),
  text: body(1_200),
});

export const experienceEntrySchema = z.object({
  id: z.string().min(1).max(64),
  company: line(160),
  role: line(160),
  startDate: line(40).default(""),
  endDate: line(40).default(""),
  /**
   * A role still being done. Kept as a flag of its own rather than inferred
   * from the words in `endDate`, because "Present", "Current", "Atual" and
   * "now" are all the same fact and none of them is a date — and an importer
   * that turned any of them into one would be inventing an end.
   */
  current: z.boolean().default(false),
  location: line(120).default(""),
  bullets: z.array(resumeBulletSchema).max(40).default([]),
});

export const educationEntrySchema = z.object({
  id: z.string().min(1).max(64),
  institution: line(160),
  degree: line(160),
  startDate: line(40).default(""),
  endDate: line(40).default(""),
  location: line(120).default(""),
  details: body(1_200).default(""),
});

/** A named group of skills — "Frontend", "Tooling" — so a suggestion can aim at one. */
export const skillGroupSchema = z.object({
  id: z.string().min(1).max(64),
  name: line(80),
  skills: z.array(line(80)).max(80).default([]),
});

export const projectEntrySchema = z.object({
  id: z.string().min(1).max(64),
  name: line(160),
  role: line(160).default(""),
  link: line(200).default(""),
  bullets: z.array(resumeBulletSchema).max(20).default([]),
});

export const languageEntrySchema = z.object({
  id: z.string().min(1).max(64),
  name: line(80),
  level: line(80).default(""),
});

export const certificationEntrySchema = z.object({
  id: z.string().min(1).max(64),
  name: line(160),
  issuer: line(160).default(""),
  year: line(40).default(""),
});

export const personalInfoSchema = z.object({
  fullName: line(160).default(""),
  /** The professional title. Role alignment reads this first. */
  headline: line(160).default(""),
  email: line(160).default(""),
  phone: line(60).default(""),
  location: line(160).default(""),
  links: z.array(line(200)).max(10).default([]),
});

/**
 * Optional sections are stored as empty arrays rather than as `undefined`.
 * A section that exists but holds nothing is one shape to render, one shape to
 * address and one shape to write into; an absent one would be three.
 */
export const resumeSchema = z.object({
  personal: personalInfoSchema.default(() => personalInfoSchema.parse({})),
  summary: z.object({ text: body(4_000).default("") }).default({ text: "" }),
  experience: z.array(experienceEntrySchema).max(40).default([]),
  education: z.array(educationEntrySchema).max(20).default([]),
  skills: z.array(skillGroupSchema).max(20).default([]),
  projects: z.array(projectEntrySchema).max(20).default([]),
  languages: z.array(languageEntrySchema).max(20).default([]),
  certifications: z.array(certificationEntrySchema).max(20).default([]),
});

export type ResumeBullet = z.output<typeof resumeBulletSchema>;
export type ExperienceEntry = z.output<typeof experienceEntrySchema>;
export type EducationEntry = z.output<typeof educationEntrySchema>;
export type SkillGroup = z.output<typeof skillGroupSchema>;
export type ProjectEntry = z.output<typeof projectEntrySchema>;
export type LanguageEntry = z.output<typeof languageEntrySchema>;
export type CertificationEntry = z.output<typeof certificationEntrySchema>;
export type PersonalInfo = z.output<typeof personalInfoSchema>;
export type Resume = z.output<typeof resumeSchema>;

/**
 * Ids are minted here and nowhere else. Short and prefixed, because they show
 * up in suggestion payloads and in the DOM, where `exp-3f7a2b91` reads as
 * something and a bare UUID does not.
 */
export function resumeId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

export function blankBullet(text = ""): ResumeBullet {
  return { id: resumeId("bul"), text };
}

export function blankExperience(): ExperienceEntry {
  return {
    id: resumeId("exp"),
    company: "",
    role: "",
    startDate: "",
    endDate: "",
    current: false,
    location: "",
    bullets: [blankBullet()],
  };
}

export function blankEducation(): EducationEntry {
  return {
    id: resumeId("edu"),
    institution: "",
    degree: "",
    startDate: "",
    endDate: "",
    location: "",
    details: "",
  };
}

export function blankSkillGroup(name = ""): SkillGroup {
  return { id: resumeId("skl"), name, skills: [] };
}

export function blankProject(): ProjectEntry {
  return { id: resumeId("prj"), name: "", role: "", link: "", bullets: [blankBullet()] };
}

export function blankLanguage(): LanguageEntry {
  return { id: resumeId("lng"), name: "", level: "" };
}

export function blankCertification(): CertificationEntry {
  return { id: resumeId("crt"), name: "", issuer: "", year: "" };
}

/** A document with one of each section that has entries, so the editor opens on something. */
export function blankResume(): Resume {
  return resumeSchema.parse({
    personal: {},
    summary: { text: "" },
    experience: [blankExperience()],
    education: [],
    skills: [blankSkillGroup("Skills")],
    projects: [],
    languages: [],
    certifications: [],
  });
}

/**
 * Reads a document that was persisted or pasted in. Anything unrecognised is
 * dropped rather than thrown at the reader: a CV that lost a field is still a
 * CV, and refusing to open it would strand the only copy the person has.
 */
export function parseResume(input: unknown): Resume | null {
  const parsed = resumeSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}
