/**
 * How a filed refusal reads.
 *
 * Two facts make the difference between an archive and a pile: how far the
 * process actually got, and how long the answer took. Both are computed here,
 * away from the database and away from React, so the wording is one decision
 * made in one place — and so it can be tested without either.
 */

/** Whole days between the stamp and the refusal. Never negative. */
export function daysToAnswer(stampedAt: Date, rejectedAt: Date): number {
  const days = Math.floor((rejectedAt.getTime() - stampedAt.getTime()) / 86_400_000);
  return days > 0 ? days : 0;
}

/** "the same day" / "after 1 day" / "after 34 days" — the wait, said plainly. */
export function answerDelay(stampedAt: Date, rejectedAt: Date): string {
  const days = daysToAnswer(stampedAt, rejectedAt);
  if (days === 0) return "the same day";
  return days === 1 ? "after 1 day" : `after ${days} days`;
}

/**
 * How far the application got before the refusal.
 *
 * An interview that was scheduled is the only claim worth making here. The
 * column the entry sat in is the applicant's own bookkeeping and can say
 * anything; a booked interview is something the other side agreed to, which is
 * why "no interview" is the phrase that carries information — it separates the
 * applications that died at the door from the ones that were actually seen.
 */
export function howFarItGot(interviewCount: number): string {
  if (interviewCount <= 0) return "No interview";
  return interviewCount === 1 ? "1 interview" : `${interviewCount} interviews`;
}

/** The share of refusals that never reached an interview, as a percentage. */
export function doorRate(total: number, beforeAnyInterview: number): number | null {
  if (total <= 0) return null;
  return Math.round((beforeAnyInterview / total) * 100);
}
