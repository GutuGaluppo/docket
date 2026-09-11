import type { NextRequest } from "next/server";

import { CV_ANALYSIS_ENABLED, CV_ANALYSIS_UNAVAILABLE } from "@/lib/features";
import { fingerprintJob, fingerprintResume } from "@/lib/tailoring/fingerprint";
import type { AnalysisStepId } from "@/lib/tailoring/steps";
import { analyzeSchema } from "@/lib/validation/resume";
import { getScope } from "@/server/auth/session";
import { canAnalyzeResume } from "@/server/billing/limits";
import { getEntry } from "@/server/db/queries/applications";
import {
  countAnalysesThisMonth,
  getResumeById,
  markResumeUsed,
  saveAnalysis,
} from "@/server/db/queries/resumes";
import {
  analyze,
  ANALYSIS_PROMPT_VERSION,
  JOB_MATCH_SCORING_VERSION,
} from "@/server/tailoring/analyze";
import { isModelConfigured, modelName } from "@/server/tailoring/model";

/**
 * Reading a CV against an advert, reported as it happens.
 *
 * A route rather than an action, and streaming rather than one answer, for one
 * reason: the interface promises a checklist of stages, and a checklist that is
 * not fed by the stages actually being passed is an animation pretending to be
 * telemetry. Each line below is written at the moment the server reaches that
 * point, so what is on screen is where the work has got to and nothing else.
 *
 * The connection is also what makes cancelling real. `request.signal` is
 * carried all the way into the model request, so closing the stream stops the
 * work rather than hiding it — and because nothing is written until the reading
 * is complete, a cancelled attempt leaves the previous result exactly where it
 * was.
 */

type Line =
  | { type: "step"; step: AnalysisStepId }
  | {
      type: "done";
      analysisId: string;
      analysis: unknown;
      jobDescription: string;
      applicationId: string | null;
    }
  | { type: "error"; error: string };

const encoder = new TextEncoder();

export async function POST(request: NextRequest) {
  if (!CV_ANALYSIS_ENABLED) {
    return Response.json({ error: CV_ANALYSIS_UNAVAILABLE }, { status: 404 });
  }

  const scope = await getScope();
  if (!scope) return Response.json({ error: "Sign in first." }, { status: 401 });

  const payload = await request.json().catch(() => null);
  const parsed = analyzeSchema.safeParse(payload);
  if (!parsed.success)
    return Response.json({ error: "That request could not be read." }, { status: 400 });

  const resume = await getResumeById(scope, parsed.data.resumeId);
  if (!resume) return Response.json({ error: "That CV was not found." }, { status: 404 });

  // The register is the record: when an entry is named, its stored advert is
  // the one read, whatever the browser sent alongside it.
  let jobDescription = parsed.data.jobDescription;
  let applicationId: string | null = null;

  if (parsed.data.applicationId) {
    const entry = await getEntry(scope, parsed.data.applicationId);
    if (!entry) return Response.json({ error: "That entry was not found." }, { status: 404 });
    if (!entry.jobDescription) {
      return Response.json(
        { error: "That entry has no job description stored with it." },
        { status: 400 },
      );
    }
    jobDescription = entry.jobDescription;
    applicationId = entry.id;
  }

  const used = await countAnalysesThisMonth(scope);
  const verdict = await canAnalyzeResume(scope, used);
  if (!verdict.allowed) return Response.json({ error: verdict.reason }, { status: 402 });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (line: Line) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(line)}\n`));
      };

      try {
        const result = await analyze({
          resume: resume.content,
          jobDescription,
          signal: request.signal,
          onStep: (step) => write({ type: "step", step }),
        });

        if (!result.ok) {
          if (result.reason !== "cancelled") {
            write({
              type: "error",
              error:
                result.reason === "empty-resume"
                  ? "There is not enough in the CV yet to compare against anything."
                  : "Paste the job description — there is not enough of it to read.",
            });
          }
          controller.close();
          return;
        }

        const record = await saveAnalysis(scope, {
          resumeId: resume.id,
          applicationId,
          jobDescription,
          resumeFingerprint: fingerprintResume(resume.content),
          jobFingerprint: fingerprintJob(jobDescription),
          scoringVersion: JOB_MATCH_SCORING_VERSION,
          promptVersion: ANALYSIS_PROMPT_VERSION,
          analysis: result.analysis,
          model:
            result.analysis.source === "model" && isModelConfigured() ? modelName() : "heuristic",
        });

        await markResumeUsed(scope, resume.id);

        write({
          type: "done",
          analysisId: record.id,
          analysis: record.analysis,
          jobDescription,
          applicationId,
        });
      } catch {
        // A dropped connection lands here as well as a real failure. Neither is
        // allowed to carry any part of the CV into a log or an error report.
        write({ type: "error", error: "We couldn't complete the analysis." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      // Proxies that buffer would hold every line until the end, which is the
      // one thing this endpoint exists not to do.
      "x-accel-buffering": "no",
    },
  });
}
