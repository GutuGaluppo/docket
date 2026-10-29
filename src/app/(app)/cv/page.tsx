import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { SectionHeader } from "@/components/SectionHeader";
import { CvSkeleton } from "@/components/Skeleton";
import { CvWorkspace } from "@/components/tailoring/CvWorkspace";
import { CV_ANALYSIS_ENABLED } from "@/lib/features";
import { analysisFreshness, fingerprintJob, fingerprintResume } from "@/lib/tailoring/fingerprint";
import { JOB_MATCH_SCORING_VERSION } from "@/lib/tailoring/score";
import { requireScope } from "@/server/auth/session";
import { listAdvertSources } from "@/server/db/queries/applications";
import {
  getLatestAnalysis,
  getPendingImport,
  getResume,
  listChanges,
  listResumes,
} from "@/server/db/queries/resumes";
import { ANALYSIS_PROMPT_VERSION, isModelConfigured } from "@/server/tailoring/model";

export const metadata: Metadata = { title: "CV" };

/**
 * One CV, one advert, two panels — and the library the CV was chosen from.
 *
 * Everything on this screen is behind a single boundary rather than several,
 * because the parts do not stand up alone: a Job Match with no document under
 * it and no recommendations beside it is a number floating on a page. The
 * heading and its explanation are printed immediately, and the workspace
 * arrives when the database has answered.
 */
async function loadWorkspace() {
  const scope = await requireScope();

  const [resume, sources, library] = await Promise.all([
    getResume(scope),
    listAdvertSources(scope),
    listResumes(scope),
  ]);

  // A reading somebody started and walked away from is reopened where they left
  // it, rather than being lost with the tab that was showing it.
  if (!resume) {
    return { resume: null, sources, library, pending: await getPendingImport(scope) } as const;
  }

  const [analysis, history] = await Promise.all([
    getLatestAnalysis(scope, resume.id),
    listChanges(scope, resume.id),
  ]);

  return { resume, sources, library, analysis, history, pending: null } as const;
}

async function Workspace({ data }: { data: ReturnType<typeof loadWorkspace> }) {
  const loaded = await data;
  const { resume, sources, library } = loaded;

  const pendingImport = loaded.pending
    ? {
        importId: loaded.pending.id,
        fileName: loaded.pending.fileName,
        pageCount: loaded.pending.pageCount,
        result: loaded.pending.result,
      }
    : null;

  if (!resume) {
    return (
      <CvWorkspace data={null} library={library} sources={sources} pendingImport={pendingImport} />
    );
  }

  const analysis = loaded.analysis;

  /**
   * A figure describes one CV read against one advert. Both can have moved
   * since, and comparing fingerprints is what says so exactly — a saved
   * document that changed nothing is not stale, and a document restored to what
   * it said is not either.
   */
  const freshness = analysis
    ? analysisFreshness({
        analysis: {
          resumeId: analysis.resumeId,
          resumeFingerprint: analysis.resumeFingerprint,
          jobFingerprint: analysis.jobFingerprint,
          scoringVersion: analysis.scoringVersion,
          promptVersion: analysis.promptVersion,
        },
        current: {
          resumeId: resume.id,
          resumeFingerprint: fingerprintResume(resume.content),
          jobFingerprint: fingerprintJob(analysis.jobDescription),
          scoringVersion: JOB_MATCH_SCORING_VERSION,
          promptVersion: ANALYSIS_PROMPT_VERSION,
        },
      })
    : null;

  // A reading of another document is not a stale version of this one's figure.
  // It is an answer to a different question, and it is not shown at all.
  const usable = analysis && freshness !== "other-resume" ? analysis : null;

  return (
    <CvWorkspace
      data={{
        resumeId: resume.id,
        resume: resume.content,
        jobDescription: usable?.jobDescription ?? "",
        applicationId: usable?.applicationId ?? null,
        analysisId: usable?.id ?? null,
        analysis: usable?.analysis ?? null,
        history: loaded.history ?? [],
        modelConfigured: isModelConfigured(),
        // Only a changed advert needs a new reading. A CV edited since, or a
        // figure computed under older arithmetic, is brought up to date on the
        // spot from the reading that is already stored.
        stale: Boolean(usable) && freshness === "stale-job",
        rescore: Boolean(usable) && (freshness === "stale-resume" || freshness === "stale-scoring"),
      }}
      library={library}
      sources={sources}
      pendingImport={pendingImport}
    />
  );
}

export default function CvPage() {
  if (!CV_ANALYSIS_ENABLED) notFound();

  // Started here and awaited inside the boundary: the page's own render path
  // must not touch the database, or the skeleton below never gets to paint.
  const data = loadWorkspace();

  return (
    <>
      <SectionHeader section="cv" />
      <Suspense fallback={<CvSkeleton />}>
        <Workspace data={data} />
      </Suspense>
    </>
  );
}
