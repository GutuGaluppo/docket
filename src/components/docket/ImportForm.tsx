"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { importEntries } from "@/server/actions/import";
import type { ImportResult } from "@/server/import/run";

export function ImportForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ImportResult | null>(null);

  return (
    <form
      suppressHydrationWarning
      className="mt-6 rounded-[3px] border border-rule bg-card p-6 shadow-paper"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(async () => {
          const outcome = await importEntries(formData);
          setResult(outcome);
          if (outcome.ok) router.refresh();
        });
      }}
    >
      <p className="eyebrow mb-4 text-muted">Bring your records in</p>

      <label className="field-label mb-2" htmlFor="file">
        File
        <span className="field-hint">.json or .csv, up to 2 MB</span>
      </label>
      <input
        id="file"
        name="file"
        type="file"
        accept=".json,.csv,application/json,text/csv"
        required
        suppressHydrationWarning
        className="w-full border-b-[1.5px] border-rule py-2 font-mono text-[13px] file:mr-3 file:cursor-pointer file:rounded-[2px] file:border file:border-stamp/40 file:bg-transparent file:px-3 file:py-1.5 file:font-mono file:text-[11px] file:tracking-[0.08em] file:text-stamp file:uppercase"
      />

      <div
        className="mt-5 flex flex-wrap items-center gap-3.5 border-t border-dashed border-rule pt-4"
        suppressHydrationWarning
      >
        <button type="submit" className="btn" disabled={pending} suppressHydrationWarning>
          {pending ? "Reading…" : "Import"}
        </button>
        <span className="font-mono text-xs text-muted">
          Existing entries are kept. Imported ones continue the numbering.
        </span>
      </div>

      {result && (
        <div
          role="status"
          className="mt-5 border-t border-rule pt-4 font-mono text-xs leading-relaxed"
        >
          {result.ok ? (
            <>
              <p className="text-stamp">
                {result.imported} {result.imported === 1 ? "entry" : "entries"} stamped into your
                docket.
              </p>
              {result.skipped.length > 0 && (
                <ul className="mt-2 list-none text-muted">
                  {result.skipped.map((skip) => (
                    <li key={`${skip.line}-${skip.reason}`}>
                      line {skip.line}: {skip.reason} — skipped
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="text-flag">{result.error}</p>
          )}
        </div>
      )}
    </form>
  );
}
