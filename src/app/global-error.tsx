"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

import { archivo, jetbrainsMono } from "@/lib/fonts";

import "./globals.css";

/**
 * Replaces the whole document when the root layout itself fails, so it carries
 * its own <html> and fonts. Reports first, then shows something plain: at this
 * point the register is unreachable and the only useful thing is to say so.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en" className={`${archivo.variable} ${jetbrainsMono.variable}`}>
      <body suppressHydrationWarning className="min-h-screen bg-paper text-ink antialiased">
        <main className="mx-auto flex min-h-screen max-w-[440px] flex-col justify-center px-5 py-16">
          <p className="eyebrow mb-2 text-flag">Registry unavailable</p>
          <h1 className="text-4xl font-bold tracking-[-0.02em]">Something broke</h1>
          <p className="mt-3 max-w-[42ch] text-sm text-muted">
            Nothing was lost. Your entries are on file and this page failed before it could show
            them. Reload, and if it happens again the fault has been recorded on our side.
          </p>

          {error.digest && (
            <p className="mt-6 font-mono text-xs text-faint">Reference {error.digest}</p>
          )}

          <a href="/docket" className="btn mt-8 inline-block w-fit no-underline">
            Back to the docket
          </a>
        </main>
      </body>
    </html>
  );
}
