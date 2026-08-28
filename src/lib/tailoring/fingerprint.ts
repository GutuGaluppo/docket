import type { Resume } from "@/lib/resume/schema";
import { resumeElements } from "@/lib/resume/target";

/**
 * Which pair of documents a reading describes.
 *
 * A Job Match is a statement about one CV and one advert as they were at the
 * moment it was computed, and both can change underneath it: the CV by being
 * edited, the advert by being swapped for another. Timestamps almost answer
 * this and get it wrong in both directions - a save that changed nothing looks
 * like a change, and a document restored to what it said looks different.
 *
 * A fingerprint answers it exactly: same text, same fingerprint. It is computed
 * the same way in the browser and on the server, which is why it is a plain
 * hash here rather than anything from `node:crypto`.
 */

/** FNV-1a, twice, at different offsets. Sixteen hex digits tells two CVs apart. */
function hash(value: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193;

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    a ^= code;
    a = Math.imul(a, 0x01000193) >>> 0;
    b ^= code + index;
    b = Math.imul(b, 0x85ebca6b) >>> 0;
  }

  return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
}

/**
 * The document, as far as anything that reads it is concerned.
 *
 * Addresses are included alongside the text: moving a bullet from one role to
 * another changes nothing about the words and everything about what the CV
 * says, and a reading of the old arrangement should not survive it.
 */
export function fingerprintResume(resume: Resume): string {
  const material = resumeElements(resume)
    .map((element) => `${element.key} ${element.text.trim()}`)
    .join("");

  return hash(material);
}

/** Whitespace is not content, so a reflowed advert is the same advert. */
export function fingerprintJob(text: string): string {
  return hash(text.replace(/\s+/g, " ").trim());
}

/**
 * Everything that has to hold for a stored reading to still be current.
 *
 * Two documents and two versions: what was read, and what read it. Section 50
 * is explicit that the model's name is not part of this — it is worth storing
 * for diagnosis, and a reading is not invalidated because a provider shipped a
 * new checkpoint.
 */
export type AnalysisFingerprint = {
  resumeId: string;
  resumeFingerprint: string;
  jobFingerprint: string;
  scoringVersion: string;
  promptVersion: string;
};

export type AnalysisFreshness =
  /** The figure on screen describes the documents on screen. */
  | "current"
  /** The CV has been edited since it was computed. */
  | "stale-resume"
  /** The advert is a different advert. */
  | "stale-job"
  /** The scoring or the instructions changed underneath it. */
  | "stale-scoring"
  /** It belongs to another CV entirely, and must not be shown at all. */
  | "other-resume";

/**
 * Whether a stored reading still describes what the person is looking at.
 *
 * The order of the checks is the order of severity. Belonging to another CV is
 * not staleness - a reading of a different document is not a worse version of
 * this one's figure, it is an answer about something else, and the interface
 * has to drop it rather than offer to refresh it.
 */
export function analysisFreshness(input: {
  analysis: AnalysisFingerprint;
  current: Omit<AnalysisFingerprint, "resumeId"> & { resumeId: string };
}): AnalysisFreshness {
  const { analysis, current } = input;

  if (analysis.resumeId !== current.resumeId) return "other-resume";
  if (analysis.jobFingerprint !== current.jobFingerprint) return "stale-job";
  if (analysis.resumeFingerprint !== current.resumeFingerprint) return "stale-resume";
  if (
    analysis.scoringVersion !== current.scoringVersion ||
    analysis.promptVersion !== current.promptVersion
  ) {
    return "stale-scoring";
  }
  return "current";
}
