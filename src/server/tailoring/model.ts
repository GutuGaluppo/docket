import "server-only";

import { resumeElements } from "@/lib/resume/target";
import type { Resume } from "@/lib/resume/schema";
import { modelReadingSchema, type ModelReading } from "@/lib/tailoring/schema";

/**
 * The one place this product talks to a language model.
 *
 * Written against the OpenAI-compatible chat endpoint with `fetch` and nothing
 * else. No SDK is added for it: the request is forty lines, the answer has to
 * be re-validated whatever sent it, and pointing `AI_BASE_URL` at a gateway or
 * at another provider then costs an environment variable rather than a
 * dependency swap.
 *
 * Absent a key, this module reports that it is not configured and the reading
 * runs on the deterministic path — the same way the product already treats
 * Resend, Sentry and PostHog. Nothing here throws its way into a page, and no
 * CV, advert or prompt is ever logged.
 */

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
/** The proposal's starting point: enough judgement for this task, cheap enough to run per application. */
const DEFAULT_MODEL = "gpt-5.4-mini";
const TIMEOUT_MS = 45_000;

/** Truncation is a cost ceiling, and adverts have long legal footers. */
const MAX_JOB_CHARS = 14_000;
const MAX_RESUME_CHARS = 14_000;

/**
 * Bumped when the instructions change in a way that changes the answer.
 *
 * It is part of what makes a stored reading current: a reading produced by an
 * older prompt is not a stale reading of the same documents, it is an answer to
 * a differently phrased question.
 */
export const ANALYSIS_PROMPT_VERSION = "2";

function apiKey(): string {
  return process.env.AI_API_KEY ?? process.env.OPENAI_API_KEY ?? "";
}

/** Whether a reading can be asked of a model at all. */
export function isModelConfigured(): boolean {
  return apiKey().length > 0;
}

export function modelName(): string {
  return process.env.AI_MODEL ?? DEFAULT_MODEL;
}

/**
 * What the model is asked to do, and the one thing it is not.
 *
 * It reads the advert into requirements and judges each against the CV, with
 * the lines that justify the judgement. It is never asked for a score — there
 * is no field for one in the shape below, because a number a model chose cannot
 * be explained, reproduced or recomputed when a bullet changes.
 *
 * Everything about not inventing is enforced twice more after this: the schema
 * refuses shapes it must not send, and `safety.ts` deletes claims the CV does
 * not support. A prompt is a request, not a guarantee.
 */
const READING_PROMPT = `You are comparing one CV against one job advert for the candidate who wrote the CV.

Do two things.

FIRST, read the advert into a list of requirements.
- One requirement per thing being asked for. "React", "technical SEO", "internal tools", "ownership".
- Deduplicate: an advert that says React three times is asking for React once.
- category is one of: skill, tool, practice, experience, responsibility, domain, soft_skill.
- importance is one of: required, important, preferred. Use the advert's own structure: what it lists under "requirements", "about you" or "must have" is required; what it lists under "nice to have", "added bonus" or "a plus" is preferred; everything else is important.
- aliases are other ways a CV might say the same thing. "SSR" is also "server-side rendering" and "server-rendered". "Observability" is also "monitoring", "dashboards", "tracing". Be generous with aliases and specific: never an alias so broad it would match any CV.
- sourceText is the sentence of the advert the requirement came from.
- keywords are terms that make THIS role specific — technologies, practices, domain words. Never generic hiring vocabulary like "team", "work", "customer", "build" or "ship".

SECOND, judge every requirement against the CV.
- "strong": the CV shows the person actually did this. Paraphrase counts — "took the search rankings from a server-rendered rebuild" is strong evidence for technical SEO and for SSR.
- "partial": mentioned, or adjacent, but not evidenced as work they did. A tool listed under Skills and never used in a role is partial for a responsibility and strong for a tool.
- "missing": nothing in the CV supports it. Say missing rather than stretching.
- evidence quotes the CV, with the element id from the outline where possible. A strong or partial verdict with no evidence is not allowed.
- confidence is how sure you are of the verdict, from 0 to 1. It is not a score.

THIRD, optionally propose wording changes, following these rules absolutely:
- Never invent skills, employers, roles, responsibilities, projects, certifications, results, metrics, numbers, clients or technologies. If it is not in the CV, it does not exist.
- A requirement the CV does not evidence is a gap. Report it as a missing requirement; never write a rewrite that claims it.
- Never add a number, percentage, duration or team size that is not already in the CV.
- Rewrites may improve clarity, structure, ordering and relevance. They may not change what the person did.
- Keep the candidate's voice and language. Prefer concrete actions over adjectives.
- Never repeat a keyword to inflate coverage.

Answer with JSON only, in exactly this shape:

{
  "jobAnalysis": {
    "roleTitle": string,
    "requirements": [{ "id": string, "name": string, "category": string, "importance": string, "aliases": [string], "sourceText": string }],
    "keywords": [{ "text": string, "weight": "primary"|"secondary", "occurrences": number }],
    "inferredSeniority": string,
    "domain": string
  },
  "matches": [{ "requirementId": string, "match": "strong"|"partial"|"missing", "confidence": number, "evidence": [{ "key": string, "source": "profile"|"experience"|"skills"|"project"|"education", "text": string }], "reasoning": string }],
  "suggestions": [{
    "targetSectionId": "personal"|"summary"|"experience"|"education"|"skills"|"projects"|"languages"|"certifications",
    "targetEntryId": string?, "targetFieldId": string?, "targetItemId": string?,
    "type": "missing_keyword"|"skill_alignment"|"experience_relevance"|"weak_wording"|"missing_evidence"|"summary_alignment"|"ats_readability"|"irrelevant_content"|"missing_requirement",
    "priority": "high"|"medium"|"low",
    "title": string, "reason": string,
    "suggestedText": string?, "relatedKeywords": [string]?, "requirementId": string?,
    "affects": ["skillsMatch"|"experienceRelevance"|"keywordCoverage"|"roleAlignment"],
    "requiresConfirmation": boolean
  }]
}

Every match must name a requirement id you returned. Every suggestion must address an element id from the CV outline; copy the ids exactly and never invent one.
Do not return a score, a percentage or a rating of any kind. The application computes those.`;

/**
 * The CV, addressed.
 *
 * The model is shown the same element keys the editor renders, which is what
 * lets a verdict cite a line and a recommendation point at one bullet rather
 * than at "the experience section". Empty fields are included: "this has no
 * summary" is a finding, and a document that hides its holes cannot be told
 * about them.
 */
export function resumeOutline(resume: Resume): string {
  const lines = resumeElements(resume).map((element) => {
    const address = [
      `section=${element.target.sectionId}`,
      element.target.entryId ? `entry=${element.target.entryId}` : "",
      element.target.fieldId ? `field=${element.target.fieldId}` : "",
      element.target.itemId ? `item=${element.target.itemId}` : "",
    ]
      .filter(Boolean)
      .join(" ");

    return `[${address}] ${element.path.join(" › ")}: ${element.text || "(empty)"}`;
  });

  return lines.join("\n").slice(0, MAX_RESUME_CHARS);
}

export type ModelFailure = "unconfigured" | "request" | "shape";

export type ReadingResult = { ok: true; data: ModelReading } | { ok: false; reason: ModelFailure };

/**
 * One part of a message: text, or a whole file for the model to look at — which
 * is how a scanned CV is read, since a picture of a document has no text to
 * send in its place.
 */
export type MessagePart =
  { type: "text"; text: string } | { type: "file"; file: { filename: string; file_data: string } };

export type JsonResult = { ok: true; data: unknown } | { ok: false; reason: ModelFailure };

/**
 * One JSON answer, and the only place a request leaves this application.
 *
 * Every task the product has comes through here, so what must be true of all of
 * them is true in one place: the timeout, `store: false`, the refusal to log
 * any content, and the fact that the answer is handed back unparsed for the
 * caller to validate.
 */
export async function requestJson(input: {
  system: string;
  parts: MessagePart[];
  /** Aborts the request when the person cancels the reading it belongs to. */
  signal?: AbortSignal;
}): Promise<JsonResult> {
  const key = apiKey();
  if (!key) return { ok: false, reason: "unconfigured" };

  const baseUrl = (process.env.AI_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      // Two ways to stop: the clock, and the person. Either ends the request.
      signal: input.signal
        ? AbortSignal.any([AbortSignal.timeout(TIMEOUT_MS), input.signal])
        : AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        model: modelName(),
        // Asked for and re-validated: the flag stops the obvious malformed
        // answers, it does not make the answer true.
        response_format: { type: "json_object" },
        store: false,
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.parts },
        ],
      }),
    });

    if (!response.ok) return { ok: false, reason: "request" };

    const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = body.choices?.[0]?.message?.content;
    if (!content) return { ok: false, reason: "shape" };

    return { ok: true, data: JSON.parse(content) as unknown };
  } catch {
    // Deliberately swallowed whole: the failure of a request carrying a CV must
    // not put any part of that CV into a log line or an error report.
    return { ok: false, reason: "request" };
  }
}

/**
 * Asks for one reading: requirements, verdicts and wording changes.
 *
 * Answers with a validated object or with a reason, never with an exception and
 * never with anything the caller has to sanitise.
 */
export async function requestReading(input: {
  resume: Resume;
  jobDescription: string;
  signal?: AbortSignal;
}): Promise<ReadingResult> {
  const answer = await requestJson({
    system: READING_PROMPT,
    signal: input.signal,
    parts: [
      {
        type: "text",
        text: [
          "JOB ADVERT",
          input.jobDescription.slice(0, MAX_JOB_CHARS),
          "",
          "CV OUTLINE — every line is one addressable element",
          resumeOutline(input.resume),
        ].join("\n"),
      },
    ],
  });

  if (!answer.ok) return answer;

  const parsed = modelReadingSchema.safeParse(answer.data);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, reason: "shape" };
}
