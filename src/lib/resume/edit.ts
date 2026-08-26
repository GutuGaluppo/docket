import {
  blankBullet,
  blankCertification,
  blankEducation,
  blankExperience,
  blankLanguage,
  blankProject,
  blankSkillGroup,
  type Resume,
} from "./schema";

/**
 * Adding and removing whole entries.
 *
 * Editing the text of something is addressed work and belongs to `target.ts`;
 * this is the other half — the structure itself. Kept apart because the rules
 * differ: text is written through an address a recommendation can hold, while
 * a new row is minted with a new id that nothing is pointing at yet, and a
 * deleted row takes every recommendation aimed at it out of play.
 */

export type EntrySection =
  "experience" | "education" | "skills" | "projects" | "languages" | "certifications";

const BLANKS = {
  experience: blankExperience,
  education: blankEducation,
  skills: () => blankSkillGroup(""),
  projects: blankProject,
  languages: blankLanguage,
  certifications: blankCertification,
} as const;

export function addEntry(resume: Resume, section: EntrySection): Resume {
  return { ...resume, [section]: [...resume[section], BLANKS[section]()] } as Resume;
}

export function removeEntry(resume: Resume, section: EntrySection, id: string): Resume {
  return {
    ...resume,
    [section]: resume[section].filter((entry: { id: string }) => entry.id !== id),
  } as Resume;
}

type BulletSection = "experience" | "projects";

export function addBullet(resume: Resume, section: BulletSection, entryId: string): Resume {
  return {
    ...resume,
    [section]: resume[section].map((entry) =>
      entry.id === entryId ? { ...entry, bullets: [...entry.bullets, blankBullet()] } : entry,
    ),
  } as Resume;
}

export function removeBullet(
  resume: Resume,
  section: BulletSection,
  entryId: string,
  bulletId: string,
): Resume {
  return {
    ...resume,
    [section]: resume[section].map((entry) =>
      entry.id === entryId
        ? { ...entry, bullets: entry.bullets.filter((bullet) => bullet.id !== bulletId) }
        : entry,
    ),
  } as Resume;
}

/** Dates, location and the other single fields an entry carries. */
export function setEntryField<S extends EntrySection>(
  resume: Resume,
  section: S,
  entryId: string,
  field: string,
  value: string,
): Resume {
  return {
    ...resume,
    [section]: resume[section].map((entry: { id: string }) =>
      entry.id === entryId ? { ...entry, [field]: value } : entry,
    ),
  } as Resume;
}
