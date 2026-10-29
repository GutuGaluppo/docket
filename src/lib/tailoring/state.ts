import type { Resume } from "@/lib/resume/schema";
import { resolveTarget, toTarget } from "@/lib/resume/target";

import { computeCoverage } from "./matching";
import type { SuggestionFilter } from "./queue";
import {
  applyEvent,
  completeSteps,
  failSteps,
  initialSteps,
  type AnalysisEvent,
  type AnalysisStep,
} from "./steps";
import type {
  JobMatch,
  JobMatchStatus,
  ResumeChange,
  ResumeSuggestion,
  TailoringAnalysis,
} from "./types";

/**
 * Everything the two panels have to agree about, in one reducer.
 *
 * The editor and the recommendation panel are the same conversation seen from
 * two sides: hovering a card lights a bullet, clicking one selects it, applying
 * changes the document under both. Holding that in a reducer rather than in
 * component state is what keeps the two in step without either one reaching
 * into the other, and it makes the interaction rules testable without a
 * browser — which is the only reason they can be tested at all here.
 *
 * Highlight is derived, never stored twice. A card is hovered; the element it
 * points at is highlighted because of that, and stops being highlighted when
 * the pointer leaves. Selection is the same relationship with a longer life.
 */
export type TailoringState = {
  resume: Resume;
  jobDescription: string;
  /** The docket entry the advert came from, when it came from one. */
  applicationId: string | null;

  analysis: TailoringAnalysis | null;
  suggestions: ResumeSuggestion[];
  jobMatch: JobMatch | null;
  status: JobMatchStatus;
  error: string;

  history: ResumeChange[];

  hoveredSuggestionId: string | null;
  activeSuggestionId: string | null;
  editingSuggestionId: string | null;
  filter: SuggestionFilter;

  /** Derived from `hoveredSuggestionId`: temporary, discreet. */
  highlightedElementKey: string | null;
  /** Derived from `activeSuggestionId`: persistent, and what the editor opens. */
  selectedElementKey: string | null;

  /**
   * A click asks the editor to scroll; hovering never does. The nonce is what
   * makes a second click on the same card scroll again.
   */
  scrollRequest: { key: string; nonce: number } | null;

  /**
   * Where a reading has got to, as the server reports reaching each stage.
   * Never advanced by a timer — see `steps.ts`.
   */
  steps: AnalysisStep[];

  /**
   * True once the advert on screen is not the one the reading was made from.
   * Until then an edit to the CV is scored against the stored reading as it is
   * typed; after it, only a new reading can say anything true.
   */
  advertChanged: boolean;

  /** The move the last applied change or undo caused, for "↑ +3". */
  lastDelta: number | null;
  /** True while a write is in flight, so two Applies cannot race. */
  busy: boolean;
};

export type TailoringAction =
  | { type: "hover"; suggestionId: string | null }
  | { type: "activate"; suggestionId: string | null }
  | { type: "edit"; suggestionId: string | null }
  | { type: "filter"; filter: SuggestionFilter }
  | { type: "job-description"; text: string; applicationId: string | null }
  | { type: "analyzing" }
  | { type: "step"; event: AnalysisEvent }
  | { type: "cancelled" }
  | { type: "analyzed"; analysis: TailoringAnalysis; history?: ResumeChange[] }
  | { type: "failed"; error: string }
  | { type: "resume-edited"; resume: Resume }
  | { type: "focus"; key: string }
  | { type: "busy"; busy: boolean }
  | {
      type: "applied";
      resume: Resume;
      change: ResumeChange;
      jobMatch: JobMatch;
      status: "applied" | "edited";
    }
  | { type: "dismissed"; suggestionId: string }
  | { type: "undone"; resume: Resume; changeId: string; jobMatch: JobMatch };

/** The address a card points at, or null when it no longer resolves. */
export function elementKeyFor(
  state: Pick<TailoringState, "resume" | "suggestions">,
  suggestionId: string | null,
): string | null {
  if (!suggestionId) return null;
  const suggestion = state.suggestions.find((candidate) => candidate.id === suggestionId);
  if (!suggestion) return null;

  const target = toTarget(suggestion);
  const element = target ? resolveTarget(state.resume, target) : null;
  return element ? element.key : null;
}

/**
 * Re-reads what each card says the document currently holds.
 *
 * Current vs Suggested is only useful while "current" is true, and a manual
 * edit two fields away can make it false. This runs on every document change,
 * which is cheap and keeps the panel honest without another round trip.
 */
function refreshCurrentText(resume: Resume, suggestions: ResumeSuggestion[]): ResumeSuggestion[] {
  return suggestions.map((suggestion) => {
    const target = toTarget(suggestion);
    const element = target ? resolveTarget(resume, target) : null;
    return element ? { ...suggestion, currentText: element.text } : suggestion;
  });
}

export function initialState(input: {
  resume: Resume;
  jobDescription?: string;
  applicationId?: string | null;
  analysis?: TailoringAnalysis | null;
  history?: ResumeChange[];
  status?: JobMatchStatus;
  /**
   * The CV was edited after the stored reading, and nothing else moved. The
   * figure is then recomputed here rather than shown as stale — the reading of
   * the advert still holds, and the arithmetic is the same one Apply runs.
   */
  rescore?: boolean;
}): TailoringState {
  const stored = input.analysis ?? null;
  const analysis = stored && input.rescore ? rescored(stored, input.resume) : stored;

  return {
    resume: input.resume,
    jobDescription: input.jobDescription ?? "",
    applicationId: input.applicationId ?? null,
    analysis,
    suggestions: analysis?.suggestions ?? [],
    jobMatch: analysis?.jobMatch ?? null,
    status: input.rescore && analysis ? "ready" : (input.status ?? (analysis ? "ready" : "idle")),
    error: "",
    history: input.history ?? [],
    hoveredSuggestionId: null,
    activeSuggestionId: null,
    editingSuggestionId: null,
    filter: "all",
    highlightedElementKey: null,
    selectedElementKey: null,
    scrollRequest: null,
    steps: initialSteps(),
    advertChanged: false,
    lastDelta: null,
    busy: false,
  };
}

/** The stored reading, with its figure and working brought up to this document. */
function rescored(analysis: TailoringAnalysis, resume: Resume): TailoringAnalysis {
  const { jobMatch, coverage, explanation } = computeCoverage(resume, analysis.jobAnalysis);
  return { ...analysis, jobMatch, coverage, explanation };
}

export function tailoringReducer(state: TailoringState, action: TailoringAction): TailoringState {
  switch (action.type) {
    case "hover": {
      return {
        ...state,
        hoveredSuggestionId: action.suggestionId,
        highlightedElementKey: elementKeyFor(state, action.suggestionId),
      };
    }

    case "activate": {
      const key = elementKeyFor(state, action.suggestionId);
      return {
        ...state,
        activeSuggestionId: action.suggestionId,
        selectedElementKey: key,
        // Leaving an edit open on a card nobody is looking at is a trap.
        editingSuggestionId:
          state.editingSuggestionId === action.suggestionId ? state.editingSuggestionId : null,
        scrollRequest: key
          ? { key, nonce: (state.scrollRequest?.nonce ?? 0) + 1 }
          : state.scrollRequest,
      };
    }

    case "edit":
      return { ...state, editingSuggestionId: action.suggestionId };

    case "filter":
      return { ...state, filter: action.filter };

    case "job-description":
      return {
        ...state,
        jobDescription: action.text,
        applicationId: action.applicationId,
        // A different advert makes the last reading a reading of something else.
        status: state.analysis ? "stale" : "idle",
        advertChanged: Boolean(state.analysis),
      };

    case "focus":
      return {
        ...state,
        scrollRequest: { key: action.key, nonce: (state.scrollRequest?.nonce ?? 0) + 1 },
      };

    case "analyzing":
      return { ...state, status: "analyzing", error: "", steps: initialSteps() };

    case "step":
      return { ...state, steps: applyEvent(state.steps, action.event) };

    case "cancelled":
      // Nothing was written, so the previous reading — if there was one — is
      // still the current one. Cancelling costs the attempt and nothing else.
      return {
        ...state,
        status: state.analysis ? "ready" : "idle",
        steps: initialSteps(),
        error: "",
      };

    case "analyzed":
      return {
        ...state,
        analysis: action.analysis,
        suggestions: refreshCurrentText(state.resume, action.analysis.suggestions),
        jobMatch: action.analysis.jobMatch,
        history: action.history ?? state.history,
        status: "ready",
        error: "",
        steps: completeSteps(state.steps),
        advertChanged: false,
        lastDelta: null,
        activeSuggestionId: null,
        selectedElementKey: null,
        editingSuggestionId: null,
      };

    case "failed":
      // The document is untouched by a failed reading, and says so by staying.
      // The checklist keeps what it had reached: how far a reading got is the
      // one useful thing a failure still knows.
      return { ...state, status: "error", error: action.error, steps: failSteps(state.steps) };

    case "resume-edited": {
      const suggestions = refreshCurrentText(action.resume, state.suggestions);

      // Only a reading that exists can go stale; with none, nothing changed.
      if (!state.analysis) return { ...state, resume: action.resume, suggestions };

      // The advert moved, so the stored reading answers a different question.
      if (state.advertChanged) {
        return { ...state, resume: action.resume, suggestions, status: "stale" };
      }

      /**
       * The advert has not moved, so its reading still holds and only the
       * arithmetic needs redoing — locally, on every edit, the way Apply
       * already does it on the server. The figure follows the typing instead
       * of going stale and waiting for a button.
       */
      const analysis = rescored(state.analysis, action.resume);
      const before = state.jobMatch?.overallScore ?? 0;
      const after = analysis.jobMatch.overallScore;

      return {
        ...state,
        resume: action.resume,
        suggestions,
        analysis: { ...analysis, suggestions: state.analysis.suggestions },
        jobMatch: analysis.jobMatch,
        // A keystroke that moves nothing keeps the last movement on screen.
        lastDelta: after !== before ? after - before : state.lastDelta,
        status: state.status === "analyzing" ? state.status : "ready",
      };
    }

    case "busy":
      return { ...state, busy: action.busy };

    case "applied": {
      const suggestions = refreshCurrentText(
        action.resume,
        state.suggestions.map((suggestion) =>
          suggestion.id === action.change.suggestionId
            ? { ...suggestion, status: action.status }
            : suggestion,
        ),
      );

      return {
        ...state,
        resume: action.resume,
        suggestions,
        history: [action.change, ...state.history],
        jobMatch: action.jobMatch,
        lastDelta: (action.jobMatch.overallScore ?? 0) - (state.jobMatch?.overallScore ?? 0),
        // The figure was recomputed against the document as it now reads, so it
        // is current — applying a suggestion does not make the analysis stale.
        status: "ready",
        editingSuggestionId: null,
        busy: false,
      };
    }

    case "dismissed":
      return {
        ...state,
        suggestions: state.suggestions.map((suggestion) =>
          suggestion.id === action.suggestionId
            ? { ...suggestion, status: "dismissed" }
            : suggestion,
        ),
        activeSuggestionId:
          state.activeSuggestionId === action.suggestionId ? null : state.activeSuggestionId,
        editingSuggestionId:
          state.editingSuggestionId === action.suggestionId ? null : state.editingSuggestionId,
        // Nothing about the document changed, so neither does the score.
        busy: false,
      };

    case "undone": {
      const change = state.history.find((entry) => entry.id === action.changeId);
      const suggestions = refreshCurrentText(
        action.resume,
        state.suggestions.map((suggestion) =>
          suggestion.id && suggestion.id === change?.suggestionId
            ? { ...suggestion, status: "pending" }
            : suggestion,
        ),
      );

      return {
        ...state,
        resume: action.resume,
        suggestions,
        history: state.history.filter((entry) => entry.id !== action.changeId),
        jobMatch: action.jobMatch,
        lastDelta: (action.jobMatch.overallScore ?? 0) - (state.jobMatch?.overallScore ?? 0),
        busy: false,
      };
    }

    default:
      return state;
  }
}
