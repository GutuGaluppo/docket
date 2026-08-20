import { z } from "zod";

/**
 * Filing a refusal takes an id and, at most, one line about it.
 *
 * The note is short on purpose. What is worth keeping about a rejection is the
 * sentence they actually used — "the position was put on hold", "we went with
 * someone more senior" — and a field big enough for an essay invites one to be
 * written at the worst possible moment. Anything longer belongs in the entry's
 * own notes, which the edit screen already has.
 */
export const fileRejectionSchema = z.object({
  id: z.string().min(1),
  reason: z.string().trim().max(280).optional().default(""),
});

export const reopenSchema = z.object({ id: z.string().min(1) });

export const archiveQuerySchema = z.object({
  q: z.string().trim().max(120).optional().default(""),
});

export type ArchiveQuery = z.output<typeof archiveQuerySchema>;
