import { resumeElements, type ResumeArea } from "./target";
import type { Resume } from "./schema";

/**
 * The document as text, kept split by area.
 *
 * Where a term appears decides what it is worth. A framework named in the
 * skills list is a claim; the same framework named inside a bullet under a job
 * is evidence. The scorer needs to tell those apart, so the text is never
 * flattened into one string until something explicitly asks for that.
 */
export type ResumeText = Record<ResumeArea, string> & { all: string };

export function resumeText(resume: Resume): ResumeText {
  const areas: ResumeText = {
    headline: "",
    summary: "",
    experience: "",
    skills: "",
    education: "",
    other: "",
    all: "",
  };

  for (const element of resumeElements(resume)) {
    if (!element.text.trim()) continue;
    areas[element.area] = `${areas[element.area]} ${element.text}`.trim();
  }

  areas.all = [
    areas.headline,
    areas.summary,
    areas.experience,
    areas.skills,
    areas.education,
    areas.other,
  ]
    .filter(Boolean)
    .join(" ");

  return areas;
}

/** Whether there is enough of a document to compare against anything. */
export function hasResumeContent(resume: Resume): boolean {
  const text = resumeText(resume);
  return text.all.replace(/\s+/g, "").length >= 40;
}
