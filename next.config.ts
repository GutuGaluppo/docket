import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

/**
 * Vercel already sends HSTS. Everything below is what it does not send.
 *
 * There is deliberately no `default-src` here. Setting it would also govern
 * `script-src` and `style-src`, and Next.js serves inline hydration scripts and
 * inline font CSS — so a `default-src 'self'` policy takes the app down on the
 * first page load. The honest first policy is the set of directives that close
 * real holes without touching how the page runs: clickjacking, injected <base>
 * tags, hijacked form targets and plugins.
 *
 * A `script-src` worth having needs a per-request nonce threaded through
 * middleware into every inline script Next emits. That is its own change, and
 * it belongs with the landing page rather than smuggled in behind a header
 * commit — anything weaker (`'unsafe-inline' 'unsafe-eval'`) reads as XSS
 * protection while providing none.
 */
const csp = [
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Older browsers that ignore frame-ancestors still honour this.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "logo.clearbit.com" },
      { protocol: "https", hostname: "www.google.com", pathname: "/s2/favicons" },
    ],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      /**
       * The landing page is public and indexable. Everything behind a session
       * is not: a header is stronger than robots.txt, which only asks.
       */
      {
        source: "/:path(docket|board|calendar|archive|analytics|settings|sign-in|monitoring)/:rest*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/api/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

/**
 * The Sentry wrapper is applied unconditionally, but every part of it that
 * talks to Sentry is gated: source maps upload only when SENTRY_AUTH_TOKEN is
 * present, and the SDK itself never initialises without a DSN. A checkout with
 * no Sentry credentials builds and runs exactly as before.
 */
export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Without a token there is nothing to authenticate with, so skip the step
  // rather than fail the build.
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  // Routes Sentry's browser requests through our own origin, so ad blockers do
  // not silently swallow error reports.
  tunnelRoute: "/monitoring",
  disableLogger: true,
});
