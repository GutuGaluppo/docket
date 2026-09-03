import { aliasPairs, resolveDetected, scanAliases } from "@/lib/alias-scan";
import { BENEFITS } from "./dictionary";

export { BENEFITS, KNOWN_BENEFITS } from "./dictionary";

const PAIRS = aliasPairs(BENEFITS);

/**
 * Finds what a job offers inside its own advert.
 *
 * Same input as `detectStack`, and deliberately so: whether the description was
 * pasted into the form or fetched from a link, it is the one text both readings
 * are made from. Returns benefits in the order they appear, without duplicates.
 */
export function detectBenefits(text: string): string[] {
  return scanAliases(text, PAIRS);
}

/**
 * Merges detector output with the person's edits. `dismissed` are detected
 * benefits they removed; `manual` are ones they typed in.
 */
export function resolveBenefits(input: {
  detected: readonly string[];
  dismissed: readonly string[];
  manual: readonly string[];
}): string[] {
  return resolveDetected(input);
}
