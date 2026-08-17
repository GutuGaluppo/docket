"use client";

import { useState, useTransition } from "react";

import { resetCalendarFeed } from "@/server/actions/interviews";

/**
 * The Google and Apple integration, such as it is — and deliberately so.
 *
 * Apple Calendar has no public write API; the supported route is an ICS
 * subscription. Google accepts the same URL. One feed therefore covers both,
 * updates itself, and asks the user for no credentials at all. The alerts are
 * carried inside the events as VALARM, which both clients raise natively.
 */
export function SubscribeCard({ feedUrl }: { feedUrl: string }) {
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState("");
  const [pending, startTransition] = useTransition();

  const webcal = feedUrl.replace(/^https?:/, "webcal:");

  return (
    <section className="flex flex-col gap-4 rounded-[3px] border border-rule bg-card p-6 shadow-paper">
      <div>
        <p className="eyebrow mb-2 text-muted">Subscribe</p>
        <p className="max-w-[62ch] text-sm text-muted">
          One link, both calendars. Interviews you add here appear there, and the alert you chose
          fires on your phone without Docket needing access to your account.
        </p>
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
            and Calendar takes it from there. By hand: File → New Calendar Subscription, then paste
            the link.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="eyebrow text-stamp">Google Calendar</p>
          <p className="text-sm text-muted">
            Other calendars → From URL → paste the link. Google refreshes on its own schedule, which
            can take several hours the first time.
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
    </section>
  );
}
