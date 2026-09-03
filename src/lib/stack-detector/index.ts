import { aliasPairs, resolveDetected, scanAliases } from "@/lib/alias-scan";
import { TECHNOLOGIES } from "./dictionary";

export { TECHNOLOGIES, KNOWN_TAGS } from "./dictionary";

const PAIRS = aliasPairs(TECHNOLOGIES);

/**
 * Finds technologies in a pasted job ad.
 *
 * Returns tags in the order they appear in the text, without duplicates. The
 * scanning rules live in `@/lib/alias-scan`, shared with the benefit detector.
 */
export function detectStack(text: string): string[] {
  return scanAliases(text, PAIRS);
}

/**
 * Merges detector output with the user's edits. `dismissed` are detected tags
 * the user removed; `manual` are tags they typed in.
 */
export function resolveTags(input: {
  detected: readonly string[];
  dismissed: readonly string[];
  manual: readonly string[];
}): string[] {
  return resolveDetected(input);
}
