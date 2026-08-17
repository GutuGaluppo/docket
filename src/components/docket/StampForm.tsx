"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { entryInputSchema, type EntryInput, type EntryValues } from "@/lib/validation/entry";
import { CityField } from "./CityField";
import { detectStack, resolveTags } from "@/lib/stack-detector";
import { probableDomain } from "@/lib/company/domain";
import { stampApplication } from "@/server/actions/entries";

const EMPTY: EntryInput = {
  company: "",
  website: "",
  position: "",
  city: "",
  country: "",
  notes: "",
  jobDescription: "",
  tags: [],
  timezone: "",
};

export function StampForm() {
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState("");

  // Detector output is derived from the pasted ad; these two hold the edits on
  // top of it, so re-pasting never silently resurrects a tag the user removed.
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [manual, setManual] = useState<string[]>([]);
  const [manualDraft, setManualDraft] = useState("");

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<EntryInput, unknown, EntryValues>({
    resolver: zodResolver(entryInputSchema),
    defaultValues: EMPTY,
    mode: "onSubmit",
  });

  const company = watch("company") ?? "";
  const jobDescription = watch("jobDescription") ?? "";
  const city = watch("city") ?? "";
  const country = watch("country") ?? "";

  const detected = useMemo(() => detectStack(jobDescription), [jobDescription]);
  const tags = useMemo(
    () => resolveTags({ detected, dismissed, manual }),
    [detected, dismissed, manual],
  );

  useEffect(() => {
    setValue("tags", tags, { shouldValidate: false });
  }, [tags, setValue]);

  function addTag(value: string) {
    const clean = value.trim();
    if (!clean) return;
    setDismissed((list) => list.filter((t) => t.toLowerCase() !== clean.toLowerCase()));
    if (!tags.some((t) => t.toLowerCase() === clean.toLowerCase())) {
      setManual((list) => [...list, clean]);
    }
    setManualDraft("");
  }

  function removeTag(value: string) {
    setManual((list) => list.filter((t) => t !== value));
    if (detected.includes(value)) {
      setDismissed((list) => (list.includes(value) ? list : [...list, value]));
    }
  }

  function clearStack() {
    setValue("jobDescription", "");
    setDismissed([]);
    setManual([]);
    setManualDraft("");
  }

  const onSubmit = handleSubmit((values) => {
    setServerError("");
    startTransition(async () => {
      const result = await stampApplication({
        ...values,
        tags,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      if (result.ok) {
        reset(EMPTY);
        setDismissed([]);
        setManual([]);
        setManualDraft("");
      } else {
        setServerError(result.error);
      }
    });
  });

  const firstError =
    serverError ||
    errors.company?.message ||
    errors.position?.message ||
    errors.tags?.message ||
    "";

  /*
    Every control below carries `suppressHydrationWarning`. Password managers —
    Dashlane, 1Password, LastPass — stamp their own attributes onto forms,
    inputs and submit buttons before React hydrates, which React then reports as
    a mismatch on every page load. The flag covers only each element's own
    attributes, one level deep, so a genuine mismatch anywhere else still
    reports; without it the warning fires constantly and stops being read.

    `data-form-type="other"` is the hint that asks those extensions not to treat
    this as a credential form. It is worth keeping — some managers honour it —
    but it does not stop Dashlane from tagging the elements.
  */
  return (
    <form
      onSubmit={onSubmit}
      noValidate
      data-form-type="other"
      suppressHydrationWarning
      className="mt-6 rounded-[3px] border border-rule bg-card p-6 shadow-paper"
    >
      <p className="eyebrow mb-4 text-muted">New entry</p>

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(210px,1fr))]">
        <div className="field">
          <label className="field-label" htmlFor="company">
            Company
          </label>
          <input
            id="company"
            data-form-type="other"
            suppressHydrationWarning
            className="field-input"
            placeholder="e.g. Loudly"
            {...register("company")}
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="website">
            Website
            <span className="field-hint">optional — brings the logo</span>
          </label>
          <input
            id="website"
            data-form-type="other"
            suppressHydrationWarning
            className="field-input"
            autoComplete="off"
            placeholder={company ? probableDomain(company) : "e.g. loudly.com"}
            {...register("website")}
          />
        </div>

        <CityField
          city={city}
          country={country}
          onChange={(next) => {
            setValue("city", next.city);
            setValue("country", next.country);
          }}
        />

        <div className="field">
          <label className="field-label" htmlFor="position">
            Position
          </label>
          <input
            id="position"
            data-form-type="other"
            suppressHydrationWarning
            className="field-input"
            placeholder="e.g. Senior Frontend Developer"
            {...register("position")}
          />
        </div>

        <div className="field col-span-full">
          <label className="field-label" htmlFor="jobDescription">
            Job description
            <span className="field-hint">paste the ad — technologies become tags on their own</span>
          </label>
          <textarea
            id="jobDescription"
            data-form-type="other"
            suppressHydrationWarning
            rows={5}
            className="field-textarea min-h-[108px]"
            placeholder="Paste the requirements here. e.g. You'll work with React, TypeScript and Next.js, with a Node.js/GraphQL backend deployed on AWS…"
            {...register("jobDescription")}
          />

          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="eyebrow text-stamp">
              {tags.length === 0
                ? "No technology recognised"
                : `${tags.length} ${tags.length === 1 ? "technology" : "technologies"} on the tag`}
            </span>
            {(jobDescription || manual.length > 0) && (
              <button type="button" className="link-quiet" onClick={clearStack}>
                Clear
              </button>
            )}
          </div>

          <div className="flex min-h-10 flex-wrap items-center gap-2 border-b-[1.5px] border-rule px-0.5 pt-2 pb-2.5">
            {tags.length === 0 ? (
              <span className="text-sm text-faint">
                Paste the description above, or write the technology in the field below.
              </span>
            ) : (
              tags.map((tag) => (
                <span
                  key={tag}
                  className={`pill${manual.includes(tag) && !detected.includes(tag) ? " pill-manual" : ""}`}
                >
                  {tag}
                  <button type="button" onClick={() => removeTag(tag)} aria-label={`Remove ${tag}`}>
                    ✕
                  </button>
                </span>
              ))
            )}
          </div>

          <div className="mt-3">
            <input
              data-form-type="other"
              suppressHydrationWarning
              className="field-input"
              value={manualDraft}
              onChange={(event) => setManualDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addTag(manualDraft);
                }
              }}
              aria-label="Add a technology by hand"
              placeholder="Missing one? Type it and press Enter"
            />
          </div>
        </div>

        <div className="field col-span-full">
          <label className="field-label" htmlFor="notes">
            Notes
            <span className="field-hint">optional — recruiter, salary range, link to the ad</span>
          </label>
          <textarea
            id="notes"
            data-form-type="other"
            suppressHydrationWarning
            rows={2}
            className="field-textarea min-h-[62px]"
            placeholder="e.g. referred by Pedro · 70–80k · technical interview on Friday"
            {...register("notes")}
          />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3.5 border-t border-dashed border-rule pt-4">
        <button type="submit" className="btn" disabled={pending} suppressHydrationWarning>
          {pending ? "Stamping…" : "Stamp application"}
        </button>
        {firstError ? (
          <span role="alert" className="font-mono text-xs text-flag">
            {firstError}
          </span>
        ) : (
          <span className="font-mono text-xs text-muted">
            The date and time are recorded automatically.
          </span>
        )}
      </div>
    </form>
  );
}
