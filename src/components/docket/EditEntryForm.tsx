"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { FreeTextCaution } from "@/components/FreeTextCaution";
import { entryInputSchema, type EntryInput, type EntryValues } from "@/lib/validation/entry";
import { probableDomain } from "@/lib/company/domain";
import { editEntry } from "@/server/actions/entries";
import type { EntryDetail } from "@/server/db/queries/applications";
import { CityField } from "./CityField";
import { StackField, useStack } from "./StackField";

/**
 * Corrects an entry that is already in the register.
 *
 * The number and the stamp are shown and cannot be changed. That is not a
 * missing feature: a register whose dates can be moved is a notebook, and the
 * whole claim of this product is that the moment an application was sent is on
 * the record. Everything a person can get wrong about the job itself is here.
 */
export function EditEntryForm({ entry }: { entry: EntryDetail }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState("");

  const stack = useStack({ description: entry.jobDescription ?? "", tags: entry.tags });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<EntryInput, unknown, EntryValues>({
    resolver: zodResolver(entryInputSchema),
    mode: "onSubmit",
    defaultValues: {
      company: entry.company,
      website: entry.website ?? "",
      position: entry.position,
      city: entry.city ?? "",
      country: entry.country ?? "",
      notes: entry.notes ?? "",
      jobDescription: entry.jobDescription ?? "",
      tags: entry.tags,
      timezone: entry.timezone ?? "",
    },
  });

  const company = watch("company") ?? "";
  const city = watch("city") ?? "";
  const country = watch("country") ?? "";

  useEffect(() => {
    setValue("tags", stack.tags, { shouldValidate: false });
    setValue("jobDescription", stack.description, { shouldValidate: false });
  }, [stack.tags, stack.description, setValue]);

  const onSubmit = handleSubmit((values) => {
    setServerError("");
    startTransition(async () => {
      const result = await editEntry({
        ...values,
        id: entry.id,
        tags: stack.tags,
        jobDescription: stack.description,
        // The timezone the entry was stamped in belongs to the stamp, so it
        // travels back unchanged rather than being re-read from this browser.
        timezone: entry.timezone ?? "",
      });
      if (result.ok) router.push("/docket");
      else setServerError(result.error);
    });
  });

  const firstError =
    serverError ||
    errors.company?.message ||
    errors.position?.message ||
    errors.tags?.message ||
    "";

  const touched = isDirty || stack.description !== (entry.jobDescription ?? "");

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      data-form-type="other"
      suppressHydrationWarning
      className="mt-6 rounded-[3px] border border-rule bg-card p-6 shadow-paper"
    >
      <p className="eyebrow mb-4 text-muted">Correcting entry</p>

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(210px,1fr))]">
        <div className="field" suppressHydrationWarning>
          <label className="field-label" htmlFor="edit-company">
            Company
          </label>
          <input
            id="edit-company"
            data-form-type="other"
            suppressHydrationWarning
            className="field-input"
            {...register("company")}
          />
        </div>

        <div className="field" suppressHydrationWarning>
          <label className="field-label" htmlFor="edit-website">
            Website
            <span className="field-hint">Optional. Adds the company logo.</span>
          </label>
          <input
            id="edit-website"
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
            setValue("city", next.city, { shouldDirty: true });
            setValue("country", next.country, { shouldDirty: true });
          }}
        />

        <div className="field" suppressHydrationWarning>
          <label className="field-label" htmlFor="edit-position">
            Position
          </label>
          <input
            id="edit-position"
            data-form-type="other"
            suppressHydrationWarning
            className="field-input"
            {...register("position")}
          />
        </div>

        <StackField stack={stack} id="edit-jobDescription" />

        <div className="field col-span-full" suppressHydrationWarning>
          <label className="field-label" htmlFor="edit-notes">
            Notes
            <span className="field-hint">
              Optional. Anything you will want to remember: who you spoke to, the salary range, how
              you found it.
            </span>
          </label>
          <textarea
            id="edit-notes"
            data-form-type="other"
            suppressHydrationWarning
            rows={2}
            className="field-textarea min-h-[62px]"
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
          {pending ? "Saving…" : "Save correction"}
        </button>
        <button
          type="button"
          className="btn btn-quiet"
          disabled={pending}
          onClick={() => router.push("/docket")}
        >
          Cancel
        </button>
        {firstError ? (
          <span role="alert" className="font-mono text-xs text-flag">
            {firstError}
          </span>
        ) : (
          <span className="font-mono text-xs text-muted">
            {touched ? "Unsaved changes." : "The number and the stamp do not change."}
          </span>
        )}
      </div>
    </form>
  );
}
