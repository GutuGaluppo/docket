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

import { addSkill } from "@/lib/resume/edit";
import type { Resume } from "@/lib/resume/schema";
import type { SuggestionFilter } from "@/lib/tailoring/queue";
import { initialState, tailoringReducer, type TailoringState } from "@/lib/tailoring/state";
import { analysisSchema } from "@/lib/tailoring/schema";
import type { AnalysisEvent } from "@/lib/tailoring/steps";
import type { ResumeChange, ResumeSuggestion, TailoringAnalysis } from "@/lib/tailoring/types";
import {
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
  /** What the autosave is doing, for the line in the toolbar. */
  saveState: "saved" | "saving" | "unsaved" | "failed";
  modelConfigured: boolean;

  hover: (suggestionId: string | null) => void;
  activate: (suggestionId: string | null) => void;
  setFilter: (filter: SuggestionFilter) => void;
  startEditing: (suggestionId: string | null) => void;

  editResume: (resume: Resume) => void;
  /** Puts one of the advert's terms in the Skills section. */
  addKeyword: (term: string) => void;
  /** Scrolls the editor or the preview to one element. */
  focusElement: (key: string) => void;
  /** Flushes the debounce now. Answers whether the document reached the server. */
  saveNow: () => Promise<boolean>;
  /** Throws away what the debounce was holding, when somebody says to. */
  discardUnsaved: () => void;
  setJobSource: (input: { applicationId: string | null; text: string }) => void;
  runAnalysis: () => void;
  /** Stops a reading in flight. Real: it aborts the request. */
  cancelAnalysis: () => void;

  apply: (suggestion: ResumeSuggestion, text: string, edited: boolean) => void;
  /** Accepts several cards as written, one after another, stopping at the first failure. */
  applyMany: (suggestions: readonly ResumeSuggestion[]) => void;
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
  /** True when the advert changed since the stored reading. */
  stale: boolean;
  /** True when only the CV moved since, so the figure is recomputed on arrival. */
  rescore?: boolean;
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
      rescore: data.rescore,
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
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [, startTransition] = useTransition();

  /* Autosave ---------------------------------------------------------------- */
  const pending = useRef<Resume | null>(null);

  useEffect(() => {
    if (!unsaved) return;
    const timer = window.setTimeout(() => {
      const document = pending.current;
      if (!document) return;
      pending.current = null;
      setSaving(true);
      void saveResume({ id: data.resumeId, resume: document })
        .then((result) => {
          // A newer edit may have arrived while this one was in flight; it has
          // its own timer and its own save, and is still unsaved.
          if (result.ok && !pending.current) setUnsaved(false);
          setSaveFailed(!result.ok);
        })
        .catch(() => setSaveFailed(true))
        .finally(() => setSaving(false));
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

  const saveNow = useCallback(async () => {
    const document = pending.current;
    if (!document) {
      setUnsaved(false);
      return true;
    }

    pending.current = null;
    const saved = await saveResume({ id: data.resumeId, resume: document });
    if (saved.ok) setUnsaved(false);
    return saved.ok;
  }, [data.resumeId]);

  const discardUnsaved = useCallback(() => {
    pending.current = null;
    setUnsaved(false);
  }, []);

  const editResume = useCallback((resume: Resume) => {
    pending.current = resume;
    setUnsaved(true);
    dispatch({ type: "resume-edited", resume });
  }, []);

  // Read through a ref so the callback below keeps one identity while typing.
  const resumeRef = useRef(state.resume);
  resumeRef.current = state.resume;

  const addKeyword = useCallback(
    (term: string) => {
      const next = addSkill(resumeRef.current, term);
      if (next !== resumeRef.current) editResume(next);
    },
    [editResume],
  );

  /* Reading the advert ------------------------------------------------------ */

  /**
   * The reading is a streamed request rather than an action call.
   *
   * The server writes a line as it reaches each stage, and those lines are the
   * only thing that moves the checklist — nothing here advances it on a timer.
   * Holding the controller is also what makes Cancel real: aborting the fetch
   * ends the request, and with it the model call inside it.
   */
  const inFlight = useRef<AbortController | null>(null);

  /**
   * Which reading the interface is waiting for.
   *
   * A person can start a reading, edit the CV and start another before the
   * first one answers — and the first one answers about a document that no
   * longer exists. Only the newest request may touch the state; anything that
   * arrives late is dropped, which is the whole of section 53.
   */
  const requestId = useRef(0);

  const runAnalysis = useCallback(() => {
    // One reading at a time. A second press while one is in flight would spend
    // a second request to answer the same question.
    if (inFlight.current) return;

    const controller = new AbortController();
    inFlight.current = controller;
    requestId.current += 1;
    const thisRequest = requestId.current;
    const isCurrent = () => requestId.current === thisRequest;

    dispatch({ type: "analyzing" });

    startTransition(async () => {
      // Whatever is in the editor is what gets read, debounce or no debounce.
      const document = pending.current;
      if (document) {
        pending.current = null;
        const saved = await saveResume({ id: data.resumeId, resume: document });
        if (saved.ok) setUnsaved(false);
      }

      try {
        const response = await fetch("/cv/analyze", {
          method: "POST",
          headers: { "content-type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            resumeId: data.resumeId,
            applicationId: state.applicationId ?? undefined,
            jobDescription: state.jobDescription,
          }),
        });

        if (!response.ok || !response.body) {
          const failure = (await response.json().catch(() => null)) as { error?: string } | null;
          if (isCurrent()) {
            dispatch({
              type: "failed",
              error: failure?.error ?? "We couldn't complete the analysis.",
            });
          }
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let finished = false;

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.trim()) continue;

            let message: {
              type?: string;
              step?: AnalysisEvent["step"];
              error?: string;
              analysisId?: string;
              analysis?: unknown;
            };
            try {
              message = JSON.parse(line) as typeof message;
            } catch {
              continue;
            }

            if (!isCurrent()) continue;

            if (message.type === "step" && message.step) {
              dispatch({ type: "step", event: { step: message.step, status: "active" } });
              continue;
            }

            if (message.type === "error") {
              finished = true;
              dispatch({
                type: "failed",
                error: message.error ?? "We couldn't complete the analysis.",
              });
              continue;
            }

            if (message.type === "done") {
              // The answer is validated here as well as on the way into the
              // database: a stream is a public endpoint's output, not a promise.
              const validated = analysisSchema.safeParse(message.analysis);
              if (!validated.success) {
                finished = true;
                dispatch({ type: "failed", error: "That reading could not be understood." });
                continue;
              }

              finished = true;
              setAnalysisId(message.analysisId ?? null);
              dispatch({
                type: "analyzed",
                analysis: validated.data as TailoringAnalysis,
              });
            }
          }
        }

        // The stream ended without saying anything conclusive: the connection
        // dropped, or the server stopped. Either way the reading did not land.
        if (!finished && !controller.signal.aborted && isCurrent()) {
          dispatch({ type: "failed", error: "The analysis stopped before it finished." });
        }
      } catch {
        if (!isCurrent()) return;
        // An abort is the person pressing Cancel, and is not a failure.
        if (controller.signal.aborted) dispatch({ type: "cancelled" });
        else dispatch({ type: "failed", error: "We couldn't complete the analysis." });
      } finally {
        if (isCurrent()) inFlight.current = null;
      }
    });
  }, [data.resumeId, state.applicationId, state.jobDescription]);

  const cancelAnalysis = useCallback(() => {
    // Bumping the id first is what makes the abort final: anything already in
    // flight is no longer the current request, whatever it goes on to say.
    requestId.current += 1;
    inFlight.current?.abort();
    inFlight.current = null;
    dispatch({ type: "cancelled" });
  }, []);

  /* Acting on a recommendation ---------------------------------------------- */
  /**
   * Applying writes on the server against the stored document, so whatever the
   * debounce is still holding goes first — otherwise the answer would come back
   * without the sentence typed a second ago, and the next save would put it
   * back without the change.
   */
  const flush = useCallback(async () => {
    const document = pending.current;
    if (!document) return true;
    pending.current = null;
    const saved = await saveResume({ id: data.resumeId, resume: document });
    if (saved.ok) setUnsaved(false);
    else pending.current = document;
    return saved.ok;
  }, [data.resumeId]);

  const apply = useCallback(
    (suggestion: ResumeSuggestion, text: string, edited: boolean) => {
      if (!analysisId) return;
      dispatch({ type: "busy", busy: true });

      startTransition(async () => {
        if (!(await flush())) {
          dispatch({ type: "failed", error: "Your latest edits could not be saved." });
          dispatch({ type: "busy", busy: false });
          return;
        }

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
    [analysisId, flush],
  );

  const applyMany = useCallback(
    (suggestions: readonly ResumeSuggestion[]) => {
      if (!analysisId || suggestions.length === 0) return;
      dispatch({ type: "busy", busy: true });

      startTransition(async () => {
        if (!(await flush())) {
          dispatch({ type: "failed", error: "Your latest edits could not be saved." });
          dispatch({ type: "busy", busy: false });
          return;
        }

        // One at a time, in the order shown: each write recomputes the figure
        // against the document the previous one left behind.
        for (const suggestion of suggestions) {
          const text = suggestion.suggestedText?.trim();
          if (!text) continue;

          const result = await applyResumeSuggestion({
            analysisId,
            suggestionId: suggestion.id,
            text,
            edited: false,
          });

          if (!result.ok) {
            dispatch({ type: "failed", error: result.error });
            break;
          }

          dispatch({
            type: "applied",
            resume: result.resume,
            change: result.change,
            jobMatch: result.jobMatch,
            status: "applied",
          });
        }

        dispatch({ type: "busy", busy: false });
      });
    },
    [analysisId, flush],
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
      saveState: saving ? "saving" : saveFailed ? "failed" : unsaved ? "unsaved" : "saved",
      modelConfigured: data.modelConfigured,
      hover: (suggestionId) => dispatch({ type: "hover", suggestionId }),
      activate: (suggestionId) => dispatch({ type: "activate", suggestionId }),
      setFilter: (filter) => dispatch({ type: "filter", filter }),
      startEditing: (suggestionId) => dispatch({ type: "edit", suggestionId }),
      editResume,
      addKeyword,
      focusElement: (key) => dispatch({ type: "focus", key }),
      saveNow,
      discardUnsaved,
      setJobSource: ({ applicationId, text }) =>
        dispatch({ type: "job-description", applicationId, text }),
      runAnalysis,
      cancelAnalysis,
      apply,
      applyMany,
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
      saving,
      saveFailed,
      cancelAnalysis,
      editResume,
      addKeyword,
      saveNow,
      discardUnsaved,
      runAnalysis,
      apply,
      applyMany,
      dismiss,
      restore,
      undo,
    ],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}
