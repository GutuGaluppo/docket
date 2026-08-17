import * as Sentry from "@sentry/nextjs";

/**
 * Browser reporting. Guarded the same way as the server side: without a public
 * DSN nothing is initialised and nothing leaves the page.
 */
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
    // No session replay: it would record the contents of the register.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
