"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";

import type { Resume } from "@/lib/resume/schema";
import type { SuggestionFilter } from "@/lib/tailoring/queue";
import { initialState, tailoringReducer, type TailoringState } from "@/lib/tailoring/state";
import type { ResumeChange, ResumeSuggestion, TailoringAnalysis } from "@/lib/tailoring/types";
import {
  analyzeResumeAgainstJob,
  applyResumeSuggestion,
  saveResume,
  setSuggestionStatus,
  undoResumeChange,
} from "@/server/actions/resume";

/**
 * The one place the editor and the recommendation panel meet.
 *
 * State lives in the reducer from `lib/tailoring/state`, which is pure and
 * tested; everything this component adds is the part that cannot be pure —
 * talking to the server, and deciding when. That split is deliberate: the
 * interaction rules are the interesting half and they are checkable without a
 * browser, while what is left here is plumbing.
 *
 * Two timing decisions worth naming:
 *
 *   · Typing saves on a debounce, and reading the advert never happens on its
 *     own. A model request per keystroke would be both slow and expensive, and
 *     section 34 asks for exactly this: the figure goes stale and says so, and
 *     recomputing it is a button the person presses.
 *   · Applying does not go through the model at all. The server writes the
 *     text, recomputes the figure from the stored reading, and answers with
 *     both — so the number moves the moment the document does.
 */

const SAVE_DEBOUNCE_MS = 1_200;

export type TailoringContextValue = {
  state: TailoringState;
  resumeId: string;
  analysisId: string | null;
  /** True while the document has unsaved edits in the browser. */
  unsaved: boolean;
  modelConfigured: boolean;

  hover: (suggestionId: string | null) => void;
  activate: (suggestionId: string | null) => void;
  setFilter: (filter: SuggestionFilter) => void;
  startEditing: (suggestionId: string | null) => void;

  editResume: (resume: Resume) => void;
  setJobSource: (input: { applicationId: string | null; text: string }) => void;
  runAnalysis: () => void;

  apply: (suggestion: ResumeSuggestion, text: string, edited: boolean) => void;
  dismiss: (suggestionId: string) => void;
  restore: (suggestionId: string) => void;
  undo: (change: ResumeChange) => void;
};

const Context = createContext<TailoringContextValue | null>(null);

export function useTailoring(): TailoringContextValue {
  const value = useContext(Context);
  if (!value) throw new Error("useTailoring must be used inside a TailoringProvider");
  return value;
}

export type TailoringInitialData = {
  resumeId: string;
  resume: Resume;
  jobDescription: string;
  applicationId: string | null;
  analysisId: string | null;
  analysis: TailoringAnalysis | null;
  history: ResumeChange[];
  /** Whether a model is available; the interface says so rather than implying it. */
  modelConfigured: boolean;
  /** True when the document has been edited since the stored reading. */
  stale: boolean;
};

export function TailoringProvider({
  data,
  children,
}: {
  data: TailoringInitialData;
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(
    tailoringReducer,
    {
      resume: data.resume,
      jobDescription: data.jobDescription,
      applicationId: data.applicationId,
      analysis: data.analysis,
      history: data.history,
      status: data.analysis
        ? data.stale
          ? ("stale" as const)
          : ("ready" as const)
        : ("idle" as const),
    },
    initialState,
  );

  const [analysisId, setAnalysisId] = useState<string | null>(data.analysisId);
  const [unsaved, setUnsaved] = useState(false);
  const [, startTransition] = useTransition();

  /* Autosave ---------------------------------------------------------------- */
  const pending = useRef<Resume | null>(null);

  useEffect(() => {
    if (!unsaved) return;
    const timer = window.setTimeout(() => {
      const document = pending.current;
      if (!document) return;
      pending.current = null;
      void saveResume({ id: data.resumeId, resume: document }).then((result) => {
        if (result.ok) setUnsaved(false);
      });
    }, SAVE_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [unsaved, state.resume, data.resumeId]);

  // A tab closed mid-edit must not lose the last sentence typed into it.
  useEffect(() => {
    if (!unsaved) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  const editResume = useCallback((resume: Resume) => {
    pending.current = resume;
    setUnsaved(true);
    dispatch({ type: "resume-edited", resume });
  }, []);

  /* Reading the advert ------------------------------------------------------ */
  const runAnalysis = useCallback(() => {
    dispatch({ type: "analyzing" });
    startTransition(async () => {
      // Whatever is in the editor is what gets read, debounce or no debounce.
      const document = pending.current;
      if (document) {
        pending.current = null;
        const saved = await saveResume({ id: data.resumeId, resume: document });
        if (saved.ok) setUnsaved(false);
      }

      const result = await analyzeResumeAgainstJob({
        resumeId: data.resumeId,
        applicationId: state.applicationId ?? undefined,
        jobDescription: state.jobDescription,
      });

      if (!result.ok) {
        dispatch({ type: "failed", error: result.error });
        return;
      }

      setAnalysisId(result.analysisId);
      dispatch({ type: "analyzed", analysis: result.analysis });
    });
  }, [data.resumeId, state.applicationId, state.jobDescription]);

  /* Acting on a recommendation ---------------------------------------------- */
  const apply = useCallback(
    (suggestion: ResumeSuggestion, text: string, edited: boolean) => {
      if (!analysisId) return;
      dispatch({ type: "busy", busy: true });

      startTransition(async () => {
        const result = await applyResumeSuggestion({
          analysisId,
          suggestionId: suggestion.id,
          text,
          edited,
        });

        if (!result.ok) {
          dispatch({ type: "failed", error: result.error });
          dispatch({ type: "busy", busy: false });
          return;
        }

        dispatch({
          type: "applied",
          resume: result.resume,
          change: result.change,
          jobMatch: result.jobMatch,
          status: edited ? "edited" : "applied",
        });
      });
    },
    [analysisId],
  );

  const dismiss = useCallback(
    (suggestionId: string) => {
      dispatch({ type: "dismissed", suggestionId });
      if (!analysisId) return;
      startTransition(async () => {
        await setSuggestionStatus({ analysisId, suggestionId, status: "dismissed" });
      });
    },
    [analysisId],
  );

  const restore = useCallback(
    (suggestionId: string) => {
      if (!analysisId) return;
      startTransition(async () => {
        const result = await setSuggestionStatus({ analysisId, suggestionId, status: "pending" });
        if (result.ok) dispatch({ type: "activate", suggestionId });
      });
    },
    [analysisId],
  );

  const undo = useCallback(
    (change: ResumeChange) => {
      dispatch({ type: "busy", busy: true });
      startTransition(async () => {
        const result = await undoResumeChange({
          changeId: change.id,
          analysisId: analysisId ?? undefined,
        });

        if (!result.ok) {
          dispatch({ type: "failed", error: result.error });
          dispatch({ type: "busy", busy: false });
          return;
        }

        dispatch({
          type: "undone",
          resume: result.resume,
          changeId: change.id,
          jobMatch: result.jobMatch ??
            state.jobMatch ?? {
              overallScore: 0,
              skillsMatch: null,
              experienceRelevance: null,
              keywordCoverage: null,
              roleAlignment: null,
            },
        });
      });
    },
    [analysisId, state.jobMatch],
  );

  const value = useMemo<TailoringContextValue>(
    () => ({
      state,
      resumeId: data.resumeId,
      analysisId,
      unsaved,
      modelConfigured: data.modelConfigured,
      hover: (suggestionId) => dispatch({ type: "hover", suggestionId }),
      activate: (suggestionId) => dispatch({ type: "activate", suggestionId }),
      setFilter: (filter) => dispatch({ type: "filter", filter }),
      startEditing: (suggestionId) => dispatch({ type: "edit", suggestionId }),
      editResume,
      setJobSource: ({ applicationId, text }) =>
        dispatch({ type: "job-description", applicationId, text }),
      runAnalysis,
      apply,
      dismiss,
      restore,
      undo,
    }),
    [
      state,
      data.resumeId,
      data.modelConfigured,
      analysisId,
      unsaved,
      editResume,
      runAnalysis,
      apply,
      dismiss,
      restore,
      undo,
    ],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}
