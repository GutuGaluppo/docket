import {
  blankBullet,
  resumeId,
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

/**
 * Adding one skill, the way the keyword list offers to.
 *
 * It lands in the first group, or in a new "Skills" group when there is none,
 * and it is refused — the same document comes back — when any group already
 * lists it under any casing. The person pressing Add is the one saying it is
 * true of them; this only saves them finding the field.
 */
export function addSkill(resume: Resume, skill: string): Resume {
  const name = skill.trim();
  if (!name) return resume;

  const listed = resume.skills.some((group) =>
    group.skills.some((existing) => existing.toLowerCase() === name.toLowerCase()),
  );
  if (listed) return resume;

  const [first, ...rest] = resume.skills;
  if (!first) {
    return { ...resume, skills: [{ ...blankSkillGroup("Skills"), skills: [name] }] };
  }
  return { ...resume, skills: [{ ...first, skills: [...first.skills, name] }, ...rest] };
}

/**
 * An independent copy of a document.
 *
 * Every id is minted again. The rows would be independent either way — they are
 * two records in a table — but the ids travel: a recommendation, a change and a
 * highlight all name one, and two documents answering to the same address is a
 * confusion waiting for the first person who tailors a copy while the original
 * is still open in another tab.
 */
export function cloneResume(resume: Resume): Resume {
  return {
    personal: { ...resume.personal, links: [...resume.personal.links] },
    summary: { ...resume.summary },
    experience: resume.experience.map((entry) => ({
      ...entry,
      id: resumeId("exp"),
      bullets: entry.bullets.map((bullet) => ({ id: resumeId("bul"), text: bullet.text })),
    })),
    education: resume.education.map((entry) => ({ ...entry, id: resumeId("edu") })),
    skills: resume.skills.map((group) => ({
      ...group,
      id: resumeId("skl"),
      skills: [...group.skills],
    })),
    projects: resume.projects.map((project) => ({
      ...project,
      id: resumeId("prj"),
      bullets: project.bullets.map((bullet) => ({ id: resumeId("bul"), text: bullet.text })),
    })),
    languages: resume.languages.map((language) => ({ ...language, id: resumeId("lng") })),
    certifications: resume.certifications.map((certification) => ({
      ...certification,
      id: resumeId("crt"),
    })),
  };
}
