import { z } from "zod";

/** Off, or one of a few sane waits. Free text here would only invite 1-day nagging. */
export const FOLLOW_UP_CHOICES = [0, 7, 10, 14, 21, 30] as const;

export const followUpLabel = (days: number) =>
  days === 0 ? "Off" : `After ${days} days`;

export const followUpSchema = z.object({
  days: z.coerce
    .number()
    .int()
    .refine((n) => (FOLLOW_UP_CHOICES as readonly number[]).includes(n), "Pick one of the options."),
});
