import "server-only";

import { resumeElements } from "@/lib/resume/target";
import type { Resume } from "@/lib/resume/schema";
import { modelAnalysisSchema, type ModelAnalysis } from "@/lib/tailoring/schema";

/**
 * The one place this product talks to a language model.
 *
 * Written against the OpenAI-compatible chat endpoint with `fetch` and nothing
 * else. No SDK is added for it: the request is forty lines, the answer is JSON
 * that has to be re-validated anyway, and pointing `AI_BASE_URL` at a gateway
 * or at a different provider then costs an environment variable rather than a
 * dependency swap.
 *
 * Absent a key, this module reports that it is not configured and the analysis
 * runs on the deterministic reading alone — the same way the product already
 * treats Resend, Sentry and PostHog. Nothing here throws its way into a page.
 *
 * What is never done here, and is the reason the module is this small:
 *
 *   · no CV, no advert and no prompt is ever logged, at any level;
 *   · `store: false` asks the provider not to retain the exchange;
 *   · the answer is parsed, not trusted — and then checked again by
 *     `safety.ts`, because a schema can confirm a shape and not a fact.
 */

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
/** The proposal's starting point: enough judgement for this task, cheap enough to run per application. */
const DEFAULT_MODEL = "gpt-5.4-mini";
const TIMEOUT_MS = 45_000;

/** Truncation is a cost ceiling, and adverts have long legal footers. */
const MAX_JOB_CHARS = 14_000;
const MAX_RESUME_CHARS = 14_000;

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
 * The rules, stated to the model as rules.
 *
 * This is section 26 of the brief, and it is written in the imperative because
 * every line of it is enforced somewhere else as well: the schema refuses the
 * shapes it must not send, and `groundSuggestions` deletes the claims it must
 * not make. The prompt is the cheap layer, not the only one.
 */
const SYSTEM_PROMPT = `You are a careful CV editor helping one candidate adapt their CV to one job advert.

Absolute rules:
- Never invent skills, employers, roles, responsibilities, projects, certifications, results, metrics, numbers, clients or technologies. If it is not in the CV, it does not exist.
- If the advert requires something the CV does not evidence, report it as a gap with type "missing_requirement" and no suggestedText. Never write a rewrite that claims it.
- Never add a number, percentage, duration or team size that does not already appear in the CV.
- Rewrites may improve clarity, structure, ordering, concision and relevance. They may not change what the person did.
- Keep the candidate's voice and language. Prefer concrete actions and outcomes over adjectives.
- Never repeat a keyword to inflate coverage. A term belongs only where it is true and reads naturally.

You answer with JSON only, in exactly this shape:

{
  "jobAnalysis": {
    "roleTitle": string,
    "requiredSkills": [{ "text": string, "importance": "required"|"important"|"preferred", "kind": "skill", "terms": [string] }],
    "preferredSkills": [ ...same shape... ],
    "responsibilities": [{ "text": string, "importance": ..., "kind": "responsibility", "terms": [string] }],
    "experienceRequirements": [{ "text": string, "importance": ..., "kind": "qualification", "terms": [string] }],
    "keywords": [{ "text": string, "weight": "primary"|"secondary", "occurrences": number }],
    "inferredSeniority": string,
    "domain": string
  },
  "suggestions": [{
    "targetSectionId": "personal"|"summary"|"experience"|"education"|"skills"|"projects"|"languages"|"certifications",
    "targetEntryId": string?,
    "targetFieldId": string?,
    "targetItemId": string?,
    "type": "missing_keyword"|"skill_alignment"|"experience_relevance"|"weak_wording"|"missing_evidence"|"summary_alignment"|"ats_readability"|"irrelevant_content"|"missing_requirement",
    "priority": "high"|"medium"|"low",
    "title": string,
    "reason": string,
    "suggestedText": string?,
    "relatedKeywords": [string]?,
    "affects": ["skillsMatch"|"experienceRelevance"|"keywordCoverage"|"roleAlignment"],
    "requiresConfirmation": boolean
  }]
}

"terms" holds the spellings that count as evidence for that requirement, so that a CV saying "TS" is credited for "TypeScript".
Every suggestion must address an element id from the CV outline. Copy the ids exactly; never invent one.
Do not include a score of any kind: the application computes it.`;

/**
 * The CV, addressed.
 *
 * The model is shown the same element keys the editor renders, which is what
 * lets a recommendation come back pointing at one bullet rather than at "the
 * experience section". Empty fields are included: "this has no summary" is a
 * finding, and a document that hides its holes cannot be told about them.
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

export type ModelResult = { ok: true; data: ModelAnalysis } | { ok: false; reason: ModelFailure };

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
 * Both tasks the product has — reading an advert, and reading a CV out of a
 * document — come through here, so what must be true of both is true in one
 * place: the timeout, `store: false`, the refusal to log any content, and the
 * fact that the answer is handed back unparsed for the caller to validate.
 */
export async function requestJson(input: {
  system: string;
  parts: MessagePart[];
}): Promise<JsonResult> {
  const key = apiKey();
  if (!key) return { ok: false, reason: "unconfigured" };

  const baseUrl = (process.env.AI_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
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
 * Asks for one reading. Answers with a validated object or with a reason, never
 * with an exception and never with anything the caller has to sanitise.
 */
export async function requestAnalysis(input: {
  resume: Resume;
  jobDescription: string;
}): Promise<ModelResult> {
  const answer = await requestJson({
    system: SYSTEM_PROMPT,
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

  const parsed = modelAnalysisSchema.safeParse(answer.data);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, reason: "shape" };
}
