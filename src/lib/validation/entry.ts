import { z } from "zod";

import { normalizeDomain } from "@/lib/company/domain";

const trimmed = (max: number) => z.string().trim().max(max);

/**
 * One schema per entity, shared by the form and the server action. The client
 * uses it through zodResolver; the action re-parses the same shape, because a
 * server action is a public endpoint no matter which button called it.
 */
export const entryInputSchema = z.object({
  company: trimmed(120).min(1, "Enter the company name."),
  website: trimmed(200)
    .optional()
    .transform((value) => (value ? normalizeDomain(value) : "")),
  position: trimmed(160).min(1, "Enter the position you applied for."),
  city: trimmed(120).optional().default(""),
  country: trimmed(120).optional().default(""),
  notes: trimmed(4_000).optional().default(""),
  jobDescription: z.string().max(50_000).optional().default(""),
  tags: z
    .array(trimmed(60).min(1))
    .max(40, "Forty tags is already more record than anyone needs.")
    .min(1, "Paste the job ad, or add a technology by hand."),
  /**
   * What the advert said the job offers. Optional where the stack is not: an
   * entry with no technology on it is a record nobody can search, while plenty
   * of real adverts genuinely name no benefit at all, and demanding one would
   * only teach people to invent them.
   */
  benefits: z
    .array(trimmed(60).min(1))
    .max(40, "Forty benefits is already more record than anyone needs.")
    .optional()
    .default([]),
  /** IANA zone from the browser, e.g. "Europe/Berlin". */
  timezone: trimmed(64).optional().default(""),
});

export type EntryInput = z.input<typeof entryInputSchema>;
export type EntryValues = z.output<typeof entryInputSchema>;

/** Naming one entry — all any action needs when it neither creates nor edits. */
export const entryIdSchema = z.object({
  id: z.string().min(1),
});

export const deleteEntrySchema = entryIdSchema;

/**
 * A correction is the same shape as an entry plus the id of the row it fixes.
 * Deliberately no protocol number and no date: those are the two things the
 * register asserts, and neither is a field anyone gets to send.
 */
export const editEntrySchema = entryInputSchema.extend({
  id: z.string().min(1),
});

export type EditEntryValues = z.output<typeof editEntrySchema>;

export const SORT_FIELDS = [
  "protocolNumber",
  "company",
  "position",
  "stack",
  "location",
  "createdAt",
] as const;

/**
 * Which half of the register a listing is showing. "open" is the default
 * everywhere: a list that keeps showing the companies that already said no is a
 * list of disappointments, not a register of what is still in play.
 */
export const ENTRY_FILTERS = ["open", "rejected", "all"] as const;

export const listQuerySchema = z.object({
  q: z.string().trim().max(120).optional().default(""),
  sort: z.enum(SORT_FIELDS).optional().default("createdAt"),
  dir: z.enum(["asc", "desc"]).optional().default("desc"),
  filter: z.enum(ENTRY_FILTERS).optional().default("open"),
});

export type ListQuery = z.output<typeof listQuerySchema>;
