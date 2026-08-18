"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { entryInputSchema, type EntryInput, type EntryValues } from "@/lib/validation/entry";
import { FreeTextCaution } from "@/components/FreeTextCaution";
import { CityField } from "./CityField";
import { DraftReview } from "./DraftReview";
import { PostingImport } from "./PostingImport";
import { detectStack, resolveTags } from "@/lib/stack-detector";
import { probableDomain } from "@/lib/company/domain";
import type { PostingDraft, PostingField, PostingSource } from "@/lib/posting/types";
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

/** Fields the link reader can fill that this form registers directly. */
type TextField = "company" | "website" | "position" | "jobDescription";

type RegisterEvent = Parameters<UseFormRegisterReturn["onChange"]>[0];

export function StampForm() {
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState("");

  // Detector output is derived from the pasted ad; these two hold the edits on
  // top of it, so re-pasting never silently resurrects a tag the user removed.
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [manual, setManual] = useState<string[]>([]);
  const [manualDraft, setManualDraft] = useState("");

  /*
    Phase B — the review step.

    `marked` holds the fields a pasted link filled and the person has not yet
    looked at. It is not validation and it does not gate the submit: a draft
    that is already correct can be stamped straight away. What it does is refuse
    to let a machine-written value pass for a hand-written one — every marked
    field carries the highlighter until it is edited, accepted, or stamped.

    The whole feature is built around this state. The link reader deliberately
    stops at "here is a draft"; the register is still only ever written by
    someone pressing Stamp.
  */
  const [marked, setMarked] = useState<PostingField[]>([]);
  const [sources, setSources] = useState<PostingSource[]>([]);

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

  function clearMarks() {
    setMarked([]);
    setSources([]);
  }

  function unmark(...fields: PostingField[]) {
    setMarked((list) =>
      list.length === 0 ? list : list.filter((field) => !fields.includes(field)),
    );
  }

  /** Registers a text field and puts the highlighter on it while it is unread. */
  function markable(field: TextField, base: string) {
    const registered = register(field);
    return {
      ...registered,
      onChange: (event: RegisterEvent) => {
        unmark(field);
        return registered.onChange(event);
      },
      className: marked.includes(field) ? `${base} marked` : base,
    };
  }

  /**
   * A draft never merges into what is already on the form. Someone who typed
   * three fields and then pasted a link is asking for the link's version; a
   * half-and-half record where nobody can tell which half came from where is
   * the outcome worth avoiding.
   */
  function applyDraft(draft: PostingDraft) {
    for (const field of draft.filled) {
      setValue(field, draft.values[field], { shouldValidate: false });
    }
    // The tag edits belonged to the previous description.
    setDismissed([]);
    setManual([]);
    setManualDraft("");
    setServerError("");
    setMarked(draft.filled);
    setSources(draft.sources);
  }

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
    unmark("jobDescription");
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
        clearMarks();
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

      <DraftReview filled={marked} sources={sources} onAccept={clearMarks} />

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(210px,1fr))]">
        <PostingImport onDraft={applyDraft} disabled={pending} />

        <div className="field" suppressHydrationWarning>
          <label className="field-label" htmlFor="company">
            Company
            {marked.includes("company") && <span className="mark-flag">check</span>}
          </label>
          <input
            id="company"
            data-form-type="other"
            suppressHydrationWarning
            placeholder="e.g. Loudly"
            {...markable("company", "field-input")}
          />
        </div>

        <div className="field" suppressHydrationWarning>
          <label className="field-label" htmlFor="website">
            Website
            {marked.includes("website") ? (
              <span className="mark-flag">check</span>
            ) : (
              <span className="field-hint">optional — brings the logo</span>
            )}
          </label>
          <input
            id="website"
            data-form-type="other"
            suppressHydrationWarning
            autoComplete="off"
            placeholder={company ? probableDomain(company) : "e.g. loudly.com"}
            {...markable("website", "field-input")}
          />
        </div>

        <CityField
          city={city}
          country={country}
          marked={marked.includes("city") || marked.includes("country")}
          onChange={(next) => {
            unmark("city", "country");
            setValue("city", next.city);
            setValue("country", next.country);
          }}
        />

        <div className="field" suppressHydrationWarning>
          <label className="field-label" htmlFor="position">
            Position
            {marked.includes("position") && <span className="mark-flag">check</span>}
          </label>
          <input
            id="position"
            data-form-type="other"
            suppressHydrationWarning
            placeholder="e.g. Senior Frontend Developer"
            {...markable("position", "field-input")}
          />
        </div>

        <div className="field col-span-full" suppressHydrationWarning>
          <label className="field-label" htmlFor="jobDescription">
            Job description
            {marked.includes("jobDescription") ? (
              <span className="mark-flag">check</span>
            ) : (
              <span className="field-hint">
                paste the ad — technologies become tags on their own
              </span>
            )}
          </label>
          <textarea
            id="jobDescription"
            data-form-type="other"
            suppressHydrationWarning
            rows={5}
            placeholder="Paste the requirements here. e.g. You'll work with React, TypeScript and Next.js, with a Node.js/GraphQL backend deployed on AWS…"
            {...markable("jobDescription", "field-textarea min-h-[108px]")}
          />
          <FreeTextCaution />

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

          <div className="mt-3" suppressHydrationWarning>
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

        <div className="field col-span-full" suppressHydrationWarning>
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
          <FreeTextCaution />
        </div>
      </div>

      <div
        className="mt-5 flex flex-wrap items-center gap-3.5 border-t border-dashed border-rule pt-4"
        suppressHydrationWarning
      >
        <button type="submit" className="btn" disabled={pending} suppressHydrationWarning>
          {pending ? "Stamping…" : "Stamp application"}
        </button>
        {firstError ? (
          <span role="alert" className="font-mono text-xs text-flag">
            {firstError}
          </span>
        ) : marked.length > 0 ? (
          <span className="font-mono text-xs text-mark-ink">
            Read the highlighted fields — they were filled from the link, not by you.
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
