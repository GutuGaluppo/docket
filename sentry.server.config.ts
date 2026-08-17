import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? "development",
  // The register holds job applications. Never ship request bodies or headers.
  sendDefaultPii: false,
  tracesSampleRate: 0.1,
});
