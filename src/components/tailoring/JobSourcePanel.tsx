"use client";

import type { AdvertSource } from "@/server/db/queries/applications";

import { useTailoring } from "./TailoringProvider";

/**
 * Where the advert comes from.
 *
 * The register is offered first, because the advert is usually already in it —
 * an entry stamped from a pasted link keeps the job description, and asking for
 * it a second time would be asking someone to fetch what they already filed.
 * Pasting one is the second door, for a role that has not been stamped yet.
 *
 * The line about what leaves the machine is not decoration. Reading a CV
 * against an advert is the only part of this product that sends what a person
 * wrote to somebody else's computer, and the sentence sits next to the button
 * that does it rather than in a policy page.
 */
export function JobSourcePanel({ sources }: { sources: AdvertSource[] }) {
  const { state, setJobSource, runAnalysis, modelConfigured } = useTailoring();

  const analyzing = state.status === "analyzing";
  const chosen = state.applicationId ?? "";
  const ready = Boolean(chosen) || state.jobDescription.trim().length >= 120;

  return (
    <section className="cv-source" aria-labelledby="cv-source-heading">
      <h2 id="cv-source-heading" className="eyebrow text-stamp">
        The advert
      </h2>

      {sources.length > 0 && (
        <div className="field">
          <label className="field-label" htmlFor="cv-source-entry">
            From your docket
          </label>
          <select
            id="cv-source-entry"
            className="field-input"
            value={chosen}
            onChange={(event) =>
              setJobSource({
                applicationId: event.target.value || null,
                text: event.target.value ? "" : state.jobDescription,
              })
            }
          >
            <option value="">Paste one instead…</option>
            {sources.map((source) => (
              <option key={source.id} value={source.id}>
                Nº {String(source.protocolNumber).padStart(3, "0")} · {source.company} —{" "}
                {source.position}
              </option>
            ))}
          </select>
          <p className="field-hint">
            Only entries that stored the advert are listed. The stored text is the one that is read.
          </p>
        </div>
      )}

      {!chosen && (
        <div className="field">
          <label className="field-label" htmlFor="cv-source-text">
            Job description
          </label>
          <textarea
            id="cv-source-text"
            className="field-textarea"
            rows={6}
            value={state.jobDescription}
            placeholder="Paste the advert here…"
            onChange={(event) => setJobSource({ applicationId: null, text: event.target.value })}
          />
          <p className="field-hint">
            {state.jobDescription.trim().length < 120
              ? "A few lines is not enough to read a role from. Paste the whole advert."
              : `${state.jobDescription.trim().length} characters.`}
          </p>
        </div>
      )}

      <div className="cv-source-actions">
        <button
          type="button"
          className="btn"
          disabled={!ready || analyzing}
          onClick={runAnalysis}
          suppressHydrationWarning
        >
          {analyzing
            ? "Reading…"
            : state.analysis
              ? "Read it again"
              : "Read my CV against this advert"}
        </button>

        <p className="cv-source-note">
          {modelConfigured
            ? "Your CV and this advert are sent to the language model for this reading, and are not stored by it. Nothing is sent while you type, and nothing is ever changed without you pressing Apply."
            : "No language model is configured, so this reading is the structural one: requirements, coverage and gaps. Nothing leaves this machine."}
        </p>
      </div>
    </section>
  );
}
