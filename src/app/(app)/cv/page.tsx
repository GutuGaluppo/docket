import type { Metadata } from "next";
import { Suspense } from "react";

import { SectionHeader } from "@/components/SectionHeader";
import { CvSkeleton } from "@/components/Skeleton";
import { JobMatchPanel } from "@/components/tailoring/JobMatchPanel";
import { JobSourcePanel } from "@/components/tailoring/JobSourcePanel";
import { ResumeEditor } from "@/components/tailoring/ResumeEditor";
import { ResumeStart } from "@/components/tailoring/ResumeStart";
import { SuggestionPanel } from "@/components/tailoring/SuggestionPanel";
import { TailoringProvider } from "@/components/tailoring/TailoringProvider";
import { requireScope } from "@/server/auth/session";
import { listAdvertSources } from "@/server/db/queries/applications";
import {
  getLatestAnalysis,
  getPendingImport,
  getResume,
  listChanges,
} from "@/server/db/queries/resumes";
import { isModelConfigured } from "@/server/tailoring/model";

export const metadata: Metadata = { title: "CV" };

/**
 * One CV, one advert, two panels.
 *
 * Everything on this screen is behind a single boundary rather than three,
 * because the parts do not stand up alone: a Job Match with no document under
 * it and no recommendations beside it is a number floating on a page. The
 * heading and its explanation are printed immediately, and the workspace
 * arrives when the database has answered.
 */
async function loadWorkspace() {
  const scope = await requireScope();

  const [resume, sources] = await Promise.all([getResume(scope), listAdvertSources(scope)]);

  // A reading somebody started and walked away from is reopened where they left
  // it, rather than being lost with the tab that was showing it.
  if (!resume) return { resume: null, sources, pending: await getPendingImport(scope) } as const;

  const [analysis, history] = await Promise.all([
    getLatestAnalysis(scope, resume.id),
    listChanges(scope, resume.id),
  ]);

  return { resume, sources, analysis, history } as const;
}

async function Workspace({ data }: { data: ReturnType<typeof loadWorkspace> }) {
  const loaded = await data;
  const { resume, sources } = loaded;

  if (!resume) {
    const pending = loaded.pending;
    return (
      <ResumeStart
        pending={
          pending
            ? {
                importId: pending.id,
                fileName: pending.fileName,
                pageCount: pending.pageCount,
                result: pending.result,
              }
            : null
        }
      />
    );
  }

  const { analysis, history } = loaded;

  /**
   * A reading describes the document as it was when it ran. If the document has
   * been saved since, the figure on screen is about a CV that no longer exists,
   * and the panel has to say so instead of quietly being wrong.
   */
  const stale = Boolean(
    analysis && resume.updatedAt.getTime() > analysis.createdAt.getTime() + 1_000,
  );

  return (
    <TailoringProvider
      data={{
        resumeId: resume.id,
        resume: resume.content,
        jobDescription: analysis?.jobDescription ?? "",
        applicationId: analysis?.applicationId ?? null,
        analysisId: analysis?.id ?? null,
        analysis: analysis?.analysis ?? null,
        history: history ?? [],
        modelConfigured: isModelConfigured(),
        stale,
      }}
    >
      <div className="cv-layout">
        <div className="cv-head">
          <JobMatchPanel />
          <JobSourcePanel sources={sources} />
        </div>

        <main className="cv-main" aria-label="Your CV">
          <ResumeEditor />
        </main>

        <SuggestionPanel />
      </div>
    </TailoringProvider>
  );
}

export default function CvPage() {
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
