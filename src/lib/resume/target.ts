import { SECTION_LABELS, type Resume, type ResumeSectionId, type SkillGroup } from "./schema";

/**
 * How a recommendation says where it applies.
 *
 * Four optional levels, from the section down to a single bullet:
 *
 *     Resume
 *     └── Section        experience
 *         └── Entry      exp-3f7a2b91   (the Loudly row)
 *             └── Field  bullets
 *                 └── Item  bul-91c4de07
 *
 * A suggestion carries whichever levels it knows. `resolveTarget` walks as deep
 * as the address goes and answers with the most specific element that exists,
 * so a recommendation aimed at a bullet that has since been deleted resolves to
 * nothing and is dropped rather than applied to the wrong text.
 */
export type ResumeTarget = {
  sectionId: ResumeSectionId;
  entryId?: string;
  fieldId?: string;
  itemId?: string;
};

/** Which part of the document a piece of text belongs to, for scoring. */
export type ResumeArea = "headline" | "summary" | "experience" | "skills" | "education" | "other";

export type ResumeElement = {
  /** Stable string form of the address. Identifies the element in state and in the DOM. */
  key: string;
  target: ResumeTarget;
  /** Breadcrumb, outermost first: ["Experience", "Loudly — Frontend Engineer", "Bullet 2"]. */
  path: string[];
  text: string;
  area: ResumeArea;
  /** Applies `next` to this element and hands back the whole document. */
  write: (next: string) => Resume;
};

/**
 * The address, flattened. Levels are joined with a character that cannot appear
 * in an id, and trailing empty levels are dropped so that `experience/exp-1`
 * and `experience/exp-1//` are the same key.
 */
export function targetKey(target: ResumeTarget): string {
  return [target.sectionId, target.entryId, target.fieldId, target.itemId]
    .filter((part): part is string => Boolean(part))
    .join("/");
}

/** The id the editor renders, and the one `scrollIntoView` looks up. */
export function elementDomId(key: string): string {
  return `cv-${key.replace(/[^A-Za-z0-9_-]/g, "_")}`;
}

/**
 * Accepts the four loose fields a suggestion arrives with and returns an
 * address, or null when the section is not one this document has.
 */
export function toTarget(input: {
  targetSectionId?: string | null;
  targetEntryId?: string | null;
  targetFieldId?: string | null;
  targetItemId?: string | null;
}): ResumeTarget | null {
  const sectionId = input.targetSectionId as ResumeSectionId | undefined;
  if (!sectionId || !(sectionId in SECTION_LABELS)) return null;
  return {
    sectionId,
    entryId: input.targetEntryId || undefined,
    fieldId: input.targetFieldId || undefined,
    itemId: input.targetItemId || undefined,
  };
}

/* -------------------------------------------------------------------------- */

/** Replaces one item of a list by id, leaving the rest of the list untouched. */
function replace<T extends { id: string }>(list: T[], id: string, edit: (item: T) => T): T[] {
  return list.map((item) => (item.id === id ? edit(item) : item));
}

/** A skill group reads and writes as one line, which is how a person edits it. */
function joinSkills(group: SkillGroup): string {
  return group.skills.join(", ");
}

function splitSkills(value: string): string[] {
  return value
    .split(/[,\n;]/)
    .map((skill) => skill.trim())
    .filter(Boolean)
    .slice(0, 80);
}

const entryLabel = (...parts: Array<string | undefined>) =>
  parts.filter(Boolean).join(" — ") || "Untitled";

/**
 * Every addressable piece of the document, in reading order.
 *
 * One function serves four callers, which is the point of it: the editor
 * renders from it, the scorer indexes from it, the validator checks suggestion
 * targets against it, and Apply writes through it. A field that is not listed
 * here is a field no recommendation can reach.
 */
export function resumeElements(resume: Resume): ResumeElement[] {
  const out: ResumeElement[] = [];

  const push = (
    target: ResumeTarget,
    path: string[],
    text: string,
    area: ResumeArea,
    write: (next: string) => Resume,
  ) => {
    out.push({ key: targetKey(target), target, path, text, area, write });
  };

  /* Personal information ---------------------------------------------------- */
  const personalFields: Array<{
    id: keyof typeof resume.personal;
    label: string;
    area: ResumeArea;
  }> = [
    { id: "fullName", label: "Full name", area: "other" },
    { id: "headline", label: "Professional title", area: "headline" },
    { id: "email", label: "Email", area: "other" },
    { id: "phone", label: "Phone", area: "other" },
    { id: "location", label: "Location", area: "other" },
  ];

  for (const field of personalFields) {
    const target = { sectionId: "personal" as const, fieldId: field.id };
    push(
      target,
      [SECTION_LABELS.personal, field.label],
      String(resume.personal[field.id] ?? ""),
      field.area,
      (next) => ({ ...resume, personal: { ...resume.personal, [field.id]: next } }),
    );
  }

  /* Summary ----------------------------------------------------------------- */
  push(
    { sectionId: "summary", fieldId: "text" },
    [SECTION_LABELS.summary],
    resume.summary.text,
    "summary",
    (next) => ({ ...resume, summary: { text: next } }),
  );

  /* Experience -------------------------------------------------------------- */
  for (const entry of resume.experience) {
    const label = entryLabel(entry.company, entry.role);
    const fields = [
      { id: "role", label: "Role", value: entry.role },
      { id: "company", label: "Company", value: entry.company },
      { id: "location", label: "Location", value: entry.location },
    ] as const;

    for (const field of fields) {
      push(
        { sectionId: "experience", entryId: entry.id, fieldId: field.id },
        [SECTION_LABELS.experience, label, field.label],
        field.value,
        field.id === "location" ? "other" : "experience",
        (next) => ({
          ...resume,
          experience: replace(resume.experience, entry.id, (item) => ({
            ...item,
            [field.id]: next,
          })),
        }),
      );
    }

    entry.bullets.forEach((bullet, index) => {
      push(
        { sectionId: "experience", entryId: entry.id, fieldId: "bullets", itemId: bullet.id },
        [SECTION_LABELS.experience, label, `Bullet ${index + 1}`],
        bullet.text,
        "experience",
        (next) => ({
          ...resume,
          experience: replace(resume.experience, entry.id, (item) => ({
            ...item,
            bullets: replace(item.bullets, bullet.id, (b) => ({ ...b, text: next })),
          })),
        }),
      );
    });
  }

  /* Education --------------------------------------------------------------- */
  for (const entry of resume.education) {
    const label = entryLabel(entry.institution, entry.degree);
    const fields = [
      { id: "degree", label: "Degree", value: entry.degree },
      { id: "institution", label: "Institution", value: entry.institution },
      { id: "details", label: "Details", value: entry.details },
    ] as const;

    for (const field of fields) {
      push(
        { sectionId: "education", entryId: entry.id, fieldId: field.id },
        [SECTION_LABELS.education, label, field.label],
        field.value,
        "education",
        (next) => ({
          ...resume,
          education: replace(resume.education, entry.id, (item) => ({ ...item, [field.id]: next })),
        }),
      );
    }
  }

  /* Skills ------------------------------------------------------------------- */
  for (const group of resume.skills) {
    push(
      { sectionId: "skills", entryId: group.id },
      [SECTION_LABELS.skills, group.name || "Untitled group"],
      joinSkills(group),
      "skills",
      (next) => ({
        ...resume,
        skills: replace(resume.skills, group.id, (item) => ({
          ...item,
          skills: splitSkills(next),
        })),
      }),
    );
  }

  /* Projects ----------------------------------------------------------------- */
  for (const project of resume.projects) {
    const label = entryLabel(project.name, project.role);
    push(
      { sectionId: "projects", entryId: project.id, fieldId: "name" },
      [SECTION_LABELS.projects, label, "Name"],
      project.name,
      "experience",
      (next) => ({
        ...resume,
        projects: replace(resume.projects, project.id, (item) => ({ ...item, name: next })),
      }),
    );

    project.bullets.forEach((bullet, index) => {
      push(
        { sectionId: "projects", entryId: project.id, fieldId: "bullets", itemId: bullet.id },
        [SECTION_LABELS.projects, label, `Bullet ${index + 1}`],
        bullet.text,
        "experience",
        (next) => ({
          ...resume,
          projects: replace(resume.projects, project.id, (item) => ({
            ...item,
            bullets: replace(item.bullets, bullet.id, (b) => ({ ...b, text: next })),
          })),
        }),
      );
    });
  }

  /* Languages ---------------------------------------------------------------- */
  for (const language of resume.languages) {
    push(
      { sectionId: "languages", entryId: language.id, fieldId: "level" },
      [SECTION_LABELS.languages, language.name || "Language", "Level"],
      language.level,
      "other",
      (next) => ({
        ...resume,
        languages: replace(resume.languages, language.id, (item) => ({ ...item, level: next })),
      }),
    );
  }

  /* Certifications ----------------------------------------------------------- */
  for (const certification of resume.certifications) {
    push(
      { sectionId: "certifications", entryId: certification.id, fieldId: "name" },
      [SECTION_LABELS.certifications, certification.name || "Certification"],
      certification.name,
      "other",
      (next) => ({
        ...resume,
        certifications: replace(resume.certifications, certification.id, (item) => ({
          ...item,
          name: next,
        })),
      }),
    );
  }

  return out;
}

/**
 * The most specific element an address reaches.
 *
 * An address that names a bullet resolves to that bullet. One that stops at the
 * entry resolves to the first element of that entry, and one that names only a
 * section resolves to the section's first element — which is what makes
 * "Professional summary" and "Skills → Frontend" legal targets alongside
 * "Experience → Loudly → bullet-2".
 */
export function resolveTarget(resume: Resume, target: ResumeTarget): ResumeElement | null {
  const elements = resumeElements(resume);
  const exact = elements.find((element) => element.key === targetKey(target));
  if (exact) return exact;

  // An address that names a specific item and misses is a dead address. Falling
  // back to the entry here would apply a recommendation written for one bullet
  // to whichever bullet took its place, which is worse than doing nothing.
  if (target.itemId) return null;

  const inSection = elements.filter((element) => element.target.sectionId === target.sectionId);
  if (inSection.length === 0) return null;

  if (target.entryId) {
    const inEntry = inSection.filter((element) => element.target.entryId === target.entryId);
    // An entry that no longer exists is a dead address, not a reason to write
    // into a neighbouring row.
    if (inEntry.length === 0) return null;
    if (target.fieldId) {
      const field = inEntry.find((element) => element.target.fieldId === target.fieldId);
      if (field) return field;
    }
    return inEntry[0] ?? null;
  }

  return inSection[0] ?? null;
}

/** Applies text to an address. Null when the address no longer resolves. */
export function writeTarget(resume: Resume, target: ResumeTarget, next: string): Resume | null {
  const element = resolveTarget(resume, target);
  return element ? element.write(next) : null;
}
