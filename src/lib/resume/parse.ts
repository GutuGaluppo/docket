import {
  blankBullet,
  resumeId,
  resumeSchema,
  type CertificationEntry,
  type EducationEntry,
  type ExperienceEntry,
  type LanguageEntry,
  type Resume,
  type SkillGroup,
} from "./schema";

/**
 * Turning a pasted CV into the structure the editor and the analysis work on.
 *
 * Everyone already has a CV, and asking them to retype it into a form before
 * the product does anything useful is where they leave. So the first thing the
 * page accepts is the text of the document they already have — copied out of a
 * PDF, a Word file, or LinkedIn — and this is what makes sense of it.
 *
 * It reads the shape almost every CV shares:
 *
 *     Ana Ribeiro                    ← name
 *     Frontend Engineer              ← title
 *     ana@example.com · Berlin       ← contact line
 *
 *     Experience                     ← a heading it recognises
 *     Loudly — Frontend Engineer     ← an entry
 *     2021 – present
 *     • Built the playback surface   ← a bullet
 *
 * What it cannot do is read a PDF: this takes text, and the person doing the
 * copying is the one who decides what is in it. Anything it fails to place
 * lands in the section it was under, and every field stays editable — a parser
 * that guesses wrong costs one correction, while a parser that refuses costs
 * the whole document.
 */

type SectionName =
  | "summary"
  | "experience"
  | "education"
  | "skills"
  | "projects"
  | "languages"
  | "certifications"
  | "header";

const HEADINGS: ReadonlyArray<{ name: SectionName; pattern: RegExp }> = [
  { name: "summary", pattern: /^(professional\s+)?(summary|profile|about( me)?|objective)\b/i },
  {
    name: "experience",
    pattern: /^(work\s+|professional\s+|relevant\s+)?(experience|employment|career history)\b/i,
  },
  { name: "education", pattern: /^(education|academic background|studies)\b/i },
  { name: "skills", pattern: /^(technical\s+)?(skills|technologies|tech stack|competencies)\b/i },
  { name: "projects", pattern: /^(projects?|selected work|portfolio)\b/i },
  { name: "languages", pattern: /^languages?\b/i },
  { name: "certifications", pattern: /^(certifications?|licenses?|courses)\b/i },
];

const BULLET = /^[-•*·–—▪]\s+|^\d+[.)]\s+/;

/**
 * Every value the schema caps is cut to fit before it gets there.
 *
 * A PDF exported without line breaks — one long run of text across the page —
 * arrives here as a single line of four hundred characters, and a schema that
 * rejects it would take the whole import down with it. Cutting is the right
 * failure: what is kept is still what the document says, and the field is
 * editable the moment it is on screen.
 */
const clamp = (value: string, max: number) => value.trim().slice(0, max);
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/;
const PHONE = /(\+?\d[\d\s().-]{7,}\d)/;
const STILL_THERE = /^(present|current|now|hoje|atual|today|ongoing)$/i;

const DATE_RANGE =
  /((?:19|20)\d{2}|\b\w{3,9}\.?\s+(?:19|20)\d{2})\s*(?:[-–—]|to|até)\s*((?:19|20)\d{2}|present|current|now|hoje|atual|\w{3,9}\.?\s+(?:19|20)\d{2})/i;

/** A heading is short, has no sentence in it, and matches one of the names above. */
function headingOf(line: string): SectionName | null {
  const text = line.trim().replace(/[:•]/g, "").trim();
  if (!text || text.length > 40 || text.split(/\s+/).length > 4) return null;
  return HEADINGS.find((heading) => heading.pattern.test(text))?.name ?? null;
}

type Block = { name: SectionName; lines: string[] };

function blocks(text: string): Block[] {
  const out: Block[] = [{ name: "header", lines: [] }];

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const heading = headingOf(line);
    if (heading) {
      out.push({ name: heading, lines: [] });
      continue;
    }
    out[out.length - 1]!.lines.push(line);
  }

  return out;
}

const isBullet = (line: string) => BULLET.test(line);
const stripBullet = (line: string) => line.replace(BULLET, "").trim();
const dropEmpty = (lines: string[]) => lines.filter((line) => line.length > 0);

/**
 * "Loudly — Frontend Engineer", "Frontend Engineer at Loudly", "Loudly | Berlin".
 * The separator decides which half is which; without one the whole line is the
 * company, because a company with no role reads better than a role with no
 * company.
 */
function splitEntryLine(line: string): { left: string; right: string } {
  const separated = line.split(/\s+[—–|·]\s+|\s+[-]\s+/);
  if (separated.length >= 2) {
    return { left: separated[0]!.trim(), right: separated.slice(1).join(" — ").trim() };
  }

  const at = line.match(/^(.+?)\s+(?:at|@|na|@)\s+(.+)$/i);
  if (at) return { left: at[2]!.trim(), right: at[1]!.trim() };

  return { left: line.trim(), right: "" };
}

function readExperience(lines: string[]): ExperienceEntry[] {
  const entries: ExperienceEntry[] = [];

  for (const line of dropEmpty(lines)) {
    if (isBullet(line) && entries.length > 0) {
      entries[entries.length - 1]!.bullets.push(blankBullet(clamp(stripBullet(line), 1_200)));
      continue;
    }

    const dates = line.match(DATE_RANGE);
    // A bare date line belongs to the entry above it rather than starting one.
    if (dates && entries.length > 0 && line.replace(DATE_RANGE, "").trim().length <= 3) {
      const previous = entries[entries.length - 1]!;
      previous.startDate = dates[1]!.trim();
      previous.endDate = dates[2]!.trim();
      previous.current = STILL_THERE.test(previous.endDate);
      continue;
    }

    const withoutDates = line
      .replace(DATE_RANGE, "")
      .replace(/[|,·—–-]\s*$/, "")
      .trim();
    const { left, right } = splitEntryLine(withoutDates);

    entries.push({
      id: resumeId("exp"),
      company: clamp(left, 160),
      role: clamp(right, 160),
      startDate: dates?.[1]?.trim() ?? "",
      endDate: dates?.[2]?.trim() ?? "",
      current: STILL_THERE.test(dates?.[2]?.trim() ?? ""),
      location: "",
      bullets: [],
    });
  }

  // An entry with nothing under it is usually a stray line, not a job — but the
  // first one is kept regardless so the editor never opens empty.
  return entries.filter((entry, index) => index === 0 || entry.company || entry.bullets.length > 0);
}

function readEducation(lines: string[]): EducationEntry[] {
  return dropEmpty(lines)
    .filter((line) => !isBullet(line))
    .map((line) => {
      const dates = line.match(DATE_RANGE);
      const { left, right } = splitEntryLine(line.replace(DATE_RANGE, "").trim());
      return {
        id: resumeId("edu"),
        institution: clamp(left, 160),
        degree: clamp(right, 160),
        startDate: dates?.[1]?.trim() ?? "",
        endDate: dates?.[2]?.trim() ?? "",
        location: "",
        details: "",
      };
    })
    .slice(0, 20);
}

/**
 * "Frontend: React, TypeScript" becomes a named group; a bare list becomes the
 * unnamed one. Grouping matters because a recommendation can point at a group,
 * and "Skills → Frontend" is an address a reader can find.
 */
function readSkills(lines: string[]): SkillGroup[] {
  const groups: SkillGroup[] = [];
  const loose: string[] = [];

  for (const line of dropEmpty(lines)) {
    const text = stripBullet(line);
    const labelled = text.match(/^([\w+#./\s-]{2,40}?)\s*:\s*(.+)$/);

    if (labelled) {
      groups.push({
        id: resumeId("skl"),
        name: clamp(labelled[1]!, 80),
        skills: splitList(labelled[2]!),
      });
      continue;
    }

    loose.push(...splitList(text));
  }

  if (loose.length > 0) {
    groups.push({
      id: resumeId("skl"),
      name: groups.length === 0 ? "Skills" : "Other",
      skills: loose,
    });
  }

  return groups.slice(0, 20);
}

function splitList(value: string): string[] {
  return value
    .split(/[,;•·|]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 1 && item.length <= 60);
}

function readLanguages(lines: string[]): LanguageEntry[] {
  return dropEmpty(lines)
    .flatMap((line) => splitList(stripBullet(line)))
    .map((item) => {
      const parts = item.match(/^(.+?)\s*[(–—-]\s*(.+?)\)?$/);
      return {
        id: resumeId("lng"),
        name: clamp(parts?.[1] ?? item, 80),
        level: clamp(parts?.[2] ?? "", 80),
      };
    })
    .slice(0, 20);
}

function readCertifications(lines: string[]): CertificationEntry[] {
  return dropEmpty(lines)
    .map((line) => {
      const text = stripBullet(line);
      const year = text.match(/((?:19|20)\d{2})/);
      const { left, right } = splitEntryLine(text.replace(/((?:19|20)\d{2})/, "").trim());
      return {
        id: resumeId("crt"),
        name: clamp(left, 160),
        issuer: clamp(right, 160),
        year: year?.[1] ?? "",
      };
    })
    .slice(0, 20);
}

/** Name, title and the contact line, read off the top of the document. */
function readHeader(lines: string[]) {
  const rows = dropEmpty(lines);
  const contactLine = rows.find((line) => EMAIL.test(line) || PHONE.test(line)) ?? "";
  const named = rows.filter((line) => line !== contactLine);

  const email = contactLine.match(EMAIL)?.[0] ?? rows.join(" ").match(EMAIL)?.[0] ?? "";
  const phone = contactLine.match(PHONE)?.[0]?.trim() ?? "";
  const location =
    contactLine
      .replace(EMAIL, "")
      .replace(PHONE, "")
      .split(/[|·•]/)
      .map((part) => part.trim())
      .find((part) => part.length > 1 && !/^https?:/i.test(part) && !part.includes("@")) ?? "";

  return {
    fullName: clamp(named[0] ?? "", 160),
    headline: clamp(named[1] ?? "", 160),
    email: clamp(email, 160),
    phone: clamp(phone, 60),
    location: clamp(location, 160),
    links: rows.filter((line) => /https?:\/\/|linkedin\.com|github\.com/i.test(line)).slice(0, 5),
  };
}

/**
 * The whole document. Never throws and never returns null: the worst case is a
 * CV whose text all landed in the summary, which is still something a person
 * can drag into place, and still something the analysis can read.
 */
export function parseResumeText(text: string): Resume {
  const found = blocks(text);
  const of = (name: SectionName) =>
    found.filter((block) => block.name === name).flatMap((b) => b.lines);

  const summaryLines = dropEmpty(of("summary"));
  const experience = readExperience(of("experience"));

  const document = resumeSchema.safeParse({
    personal: readHeader(of("header")),
    summary: { text: clamp(summaryLines.join("\n"), 4_000) },
    experience,
    education: readEducation(of("education")),
    skills: readSkills(of("skills")),
    projects: [],
    languages: readLanguages(of("languages")),
    certifications: readCertifications(of("certifications")),
  });

  if (document.success) return document.data;

  // Nothing here is allowed to throw: this runs on whatever came out of a PDF,
  // and a document that could not be shaped is still a document somebody has to
  // be able to work with. Everything lands in the summary, where it is visible
  // and editable, rather than in an error page.
  return resumeSchema.parse({ summary: { text: clamp(text, 4_000) } });
}
