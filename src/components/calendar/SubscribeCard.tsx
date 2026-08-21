"use client";

import { useRef, useState, useTransition } from "react";

import { resetCalendarFeed } from "@/server/actions/interviews";

/**
 * The Google and Apple integration, such as it is — and deliberately so.
 *
 * Apple Calendar has no public write API; the supported route is an ICS
 * subscription. Google accepts the same URL. One feed therefore covers both,
 * updates itself, and asks the user for no credentials at all. The alerts are
 * carried inside the events as VALARM, which both clients raise natively.
 *
 * All of that is set-up: read once, done once per device, and then never
 * relevant again. It sat permanently under the month grid explaining itself to
 * people who had already followed it, so it now lives behind a button — the
 * page keeps the month, and the instructions come when they are asked for.
 */
export function SubscribeCard({ feedUrl }: { feedUrl: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState("");
  const [pending, startTransition] = useTransition();

  const webcal = feedUrl.replace(/^https?:/, "webcal:");
  const close = () => {
    if (!pending) dialogRef.current?.close();
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-3" suppressHydrationWarning>
        <button
          type="button"
          className="btn btn-quiet"
          suppressHydrationWarning
          onClick={() => {
            setNotice("");
            dialogRef.current?.showModal();
          }}
        >
          Add to your calendar
        </button>
        <span className="font-mono text-xs text-muted">
          One link, both Apple and Google. Set up once per device.
        </span>
      </div>

      <dialog
        ref={dialogRef}
        aria-labelledby="subscribe-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        onCancel={(event) => {
          if (pending) event.preventDefault();
        }}
        className="m-auto w-[min(94vw,660px)] rounded-[3px] border border-rule bg-card p-0 text-ink shadow-paper backdrop:bg-ink/55"
      >
        <div className="flex flex-col gap-5 p-6 sm:p-8">
          <div className="flex items-start justify-between gap-5">
            <div>
              <p className="eyebrow text-stamp">Calendar feed</p>
              <h2 id="subscribe-title" className="mt-2 text-2xl font-bold tracking-[-0.02em]">
                Put these interviews in your own calendar
              </h2>
              <p className="mt-2.5 max-w-[62ch] text-sm text-muted">
                One link, both calendars. Interviews you add here appear there, and the alert you
                chose fires on your phone without Docket needing access to your account.
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              disabled={pending}
              aria-label="Close"
              className="cursor-pointer p-1 font-mono text-xl leading-none text-muted disabled:cursor-wait"
              suppressHydrationWarning
            >
              ×
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2" suppressHydrationWarning>
            <code className="min-w-0 flex-1 overflow-x-auto rounded-[2px] border border-rule bg-sheet px-3 py-2 font-mono text-xs whitespace-nowrap text-ink">
              {feedUrl}
            </code>
            <button
              type="button"
              className="btn btn-quiet"
              suppressHydrationWarning
              onClick={async () => {
                await navigator.clipboard.writeText(feedUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2500);
              }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <p className="eyebrow text-stamp">Apple Calendar</p>
              <p className="text-sm text-muted">
                <a href={webcal} className="border-b border-stamp text-ink">
                  Open the subscription
                </a>{" "}
                and Calendar takes it from there. By hand: File → New Calendar Subscription, then
                paste the link.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="eyebrow text-stamp">Google Calendar</p>
              <p className="text-sm text-muted">
                Other calendars → From URL → paste the link. Google refreshes on its own schedule,
                which can take several hours the first time.
              </p>
            </div>
          </div>

          <div
            className="flex flex-wrap items-center gap-3 border-t border-dashed border-rule pt-4"
            suppressHydrationWarning
          >
            <button
              type="button"
              className="link-quiet"
              suppressHydrationWarning
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await resetCalendarFeed();
                  setNotice(result.ok ? (result.message ?? "Done.") : result.error);
                })
              }
            >
              {pending ? "Generating…" : "Generate a new link"}
            </button>
            <span className="font-mono text-xs text-muted">
              {notice || "Anyone with this link can read your interviews. Rotate it if it leaks."}
            </span>
          </div>
        </div>
      </dialog>
    </>
  );
}
