import { z } from "zod";

/** Reminder offsets the calendar clients handle well. */
export const REMINDER_CHOICES = [0, 15, 30, 60, 120, 1440] as const;

export const reminderLabel = (minutes: number) => {
  if (minutes === 0) return "No alert";
  if (minutes < 60) return `${minutes} minutes before`;
  if (minutes === 60) return "1 hour before";
  if (minutes < 1440) return `${minutes / 60} hours before`;
  return "1 day before";
};

export const DURATION_CHOICES = [15, 30, 45, 60, 90, 120] as const;

export const interviewInputSchema = z.object({
  applicationId: z.string().min(1, "Pick which application this is for."),
  title: z.string().trim().min(1, "Name the interview.").max(120),
  /**
   * Local wall-clock from `<input type="datetime-local">`, plus the browser's
   * IANA zone. Both are needed: 14:00 in Berlin and 14:00 in São Paulo are
   * different instants, and the calendar feed has to emit the right one.
   */
  startsAtLocal: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Pick a date and a time."),
  timezone: z.string().trim().max(64).optional().default(""),
  durationMinutes: z.coerce.number().int().min(5).max(600).default(60),
  location: z.string().trim().max(200).optional().default(""),
  notes: z.string().trim().max(2_000).optional().default(""),
  remindMinutes: z.coerce.number().int().min(0).max(10_080).default(60),
});

export type InterviewInput = z.input<typeof interviewInputSchema>;
export type InterviewValues = z.output<typeof interviewInputSchema>;

export const interviewIdSchema = z.object({ id: z.string().min(1) });

/**
 * Resolves "2026-08-20T14:00" in a named zone to a real instant.
 *
 * Done with Intl rather than a date library: format the guessed instant back in
 * the target zone, measure how far off it landed, and correct. Two passes are
 * enough for every zone, including the half-hour and 45-minute offsets.
 */
export function zonedToInstant(local: string, timeZone: string): Date {
  const guess = new Date(`${local}:00Z`);
  if (!timeZone) return new Date(`${local}:00`);

  let instant = guess;
  for (let pass = 0; pass < 2; pass += 1) {
    const offset = offsetAt(instant, timeZone);
    instant = new Date(guess.getTime() - offset);
  }
  return instant;
}

/** Milliseconds that `timeZone` is ahead of UTC at the given instant. */
function offsetAt(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return asUtc - instant.getTime();
}
