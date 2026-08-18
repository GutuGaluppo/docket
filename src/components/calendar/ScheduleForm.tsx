"use client";

import { useState, useTransition } from "react";

import { FreeTextCaution } from "@/components/FreeTextCaution";
import { scheduleInterview } from "@/server/actions/interviews";
import { DURATION_CHOICES, REMINDER_CHOICES, reminderLabel } from "@/lib/validation/interview";

export type ApplicationOption = {
  id: string;
  label: string;
};

export function ScheduleForm({ applications }: { applications: readonly ApplicationOption[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  if (applications.length === 0) {
    return (
      <p className="rounded-[3px] border border-dashed border-rule bg-card p-4 font-mono text-xs text-muted">
        Stamp an application first — an interview always belongs to one.
      </p>
    );
  }

  if (!open) {
    // Wrapped rather than returned bare: password managers stamp the container
    // of a control as well as the control, and a bare button would push that
    // requirement onto whatever page happens to render this.
    return (
      <div className="w-fit" suppressHydrationWarning>
        <button type="button" className="btn" onClick={() => setOpen(true)} suppressHydrationWarning>
          Schedule an interview
        </button>
      </div>
    );
  }

  return (
    <form
      suppressHydrationWarning
      data-form-type="other"
      className="rounded-[3px] border border-rule bg-card p-6 shadow-paper"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setError("");
        startTransition(async () => {
          const result = await scheduleInterview({
            applicationId: data.get("applicationId"),
            title: data.get("title"),
            startsAtLocal: data.get("startsAtLocal"),
            durationMinutes: data.get("durationMinutes"),
            location: data.get("location"),
            notes: data.get("notes"),
            remindMinutes: data.get("remindMinutes"),
            // The browser's zone, so the wall clock typed above resolves to the
            // right instant and the feed emits it correctly.
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          });
          if (result.ok) setOpen(false);
          else setError(result.error);
        });
      }}
    >
      <p className="eyebrow mb-4 text-muted">New interview</p>

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(210px,1fr))]">
        <div className="field col-span-full" suppressHydrationWarning>
          <label className="field-label" htmlFor="applicationId">
            Application
          </label>
          <select
            id="applicationId"
            name="applicationId"
            required
            suppressHydrationWarning
            className="field-input cursor-pointer"
          >
            {applications.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field" suppressHydrationWarning>
          <label className="field-label" htmlFor="title">
            What is it
          </label>
          <input
            id="title"
            name="title"
            required
            defaultValue="Interview"
            suppressHydrationWarning
            data-form-type="other"
            className="field-input"
            placeholder="e.g. Technical round"
          />
        </div>

        <div className="field" suppressHydrationWarning>
          <label className="field-label" htmlFor="startsAtLocal">
            When
            <span className="field-hint">your local time</span>
          </label>
          <input
            id="startsAtLocal"
            name="startsAtLocal"
            type="datetime-local"
            required
            suppressHydrationWarning
            data-form-type="other"
            className="field-input"
          />
        </div>

        <div className="field" suppressHydrationWarning>
          <label className="field-label" htmlFor="durationMinutes">
            How long
          </label>
          <select
            id="durationMinutes"
            name="durationMinutes"
            defaultValue={60}
            suppressHydrationWarning
            className="field-input cursor-pointer"
          >
            {DURATION_CHOICES.map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes} minutes
              </option>
            ))}
          </select>
        </div>

        <div className="field" suppressHydrationWarning>
          <label className="field-label" htmlFor="remindMinutes">
            Alert
            <span className="field-hint">fires in your calendar app</span>
          </label>
          <select
            id="remindMinutes"
            name="remindMinutes"
            defaultValue={60}
            suppressHydrationWarning
            className="field-input cursor-pointer"
          >
            {REMINDER_CHOICES.map((minutes) => (
              <option key={minutes} value={minutes}>
                {reminderLabel(minutes)}
              </option>
            ))}
          </select>
        </div>

        <div className="field col-span-full" suppressHydrationWarning>
          <label className="field-label" htmlFor="location">
            Where
            <span className="field-hint">optional — a link counts</span>
          </label>
          <input
            id="location"
            name="location"
            suppressHydrationWarning
            data-form-type="other"
            className="field-input"
            placeholder="e.g. Google Meet, or Friedrichstraße 12"
          />
        </div>

        <div className="field col-span-full" suppressHydrationWarning>
          <label className="field-label" htmlFor="notes">
            Notes
            <span className="field-hint">optional — travels into the calendar event</span>
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={2}
            suppressHydrationWarning
            data-form-type="other"
            className="field-textarea min-h-[62px]"
            placeholder="e.g. with Ana from the platform team · take-home reviewed"
          />
          <FreeTextCaution />
        </div>
      </div>

      <div
        className="mt-5 flex flex-wrap items-center gap-3.5 border-t border-dashed border-rule pt-4"
        suppressHydrationWarning
      >
        <button type="submit" className="btn" disabled={pending} suppressHydrationWarning>
          {pending ? "Scheduling…" : "Schedule"}
        </button>
        <button
          type="button"
          className="link-quiet"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          Cancel
        </button>
        {error && (
          <span role="alert" className="font-mono text-xs text-flag">
            {error}
          </span>
        )}
      </div>
    </form>
  );
}
