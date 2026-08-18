/**
 * Sits under every field that stores whatever the person types.
 *
 * These are the only places in Docket where the shape of the data is not
 * decided by us, and GDPR art. 9 treats health, beliefs and union membership
 * as a category with a stricter regime than the rest of the register. Saying so
 * once, quietly, next to the box is worth more than a clause in a policy nobody
 * opens — and it keeps the promise cheap to keep: what is never typed never
 * has to be protected.
 *
 * Deliberately not a warning icon or a coloured banner. It is a fact about the
 * field, not an alarm.
 */
export function FreeTextCaution() {
  return (
    <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-faint">
      Stored as written. Health, beliefs and union membership are better left out.
    </p>
  );
}
