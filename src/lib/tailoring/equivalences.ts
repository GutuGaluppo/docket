/**
 * The words that mean the same thing.
 *
 * A CV is not written in the advert's vocabulary. Somebody who has done the
 * work writes "server-rendered pages", "monitoring dashboards", "usable with a
 * screen reader" — and an advert asks for "SSR", "observability",
 * "accessibility". A matcher that only reads the advert's own spelling scores
 * paraphrase as absence, which means it scores honesty as absence and rewards
 * copy-and-paste.
 *
 * This table is the deterministic half of the answer: a curated set of
 * equivalences that carry the common cases without a model. The model, when one
 * is configured, does the rest — it can see that "took the search rankings from
 * a rebuild" is evidence for technical SEO, which no table will ever hold.
 *
 * Two rules for adding to it. An alias must be evidence *for the requirement*,
 * not merely near it: "React" is not an alias for "frontend architecture". And
 * an alias must be specific enough to be wrong rarely — "state" would match
 * every CV ever written, so the alias is "state management".
 */

export type Equivalence = {
  /** What the advert asks for, normalised to lower case. */
  term: string;
  /** Other ways of saying it, any one of which counts as evidence. */
  aliases: readonly string[];
};

export const EQUIVALENCES: readonly Equivalence[] = [
  {
    term: "accessibility",
    aliases: [
      "a11y",
      "wcag",
      "screen reader",
      "screen readers",
      "assistive technology",
      "keyboard navigation",
      "accessible",
      "aria",
    ],
  },
  {
    term: "observability",
    aliases: [
      "monitoring",
      "production monitoring",
      "dashboards",
      "tracing",
      "telemetry",
      "error monitoring",
      "alerting",
      "grafana",
      "honeycomb",
      "datadog",
      "sentry",
      "prometheus",
    ],
  },
  {
    term: "ssr",
    aliases: [
      "server-side rendering",
      "server side rendering",
      "server-rendered",
      "server rendered",
      "ssg",
      "static generation",
      "isr",
      "rendering strategy",
      "rendering strategies",
    ],
  },
  {
    term: "technical seo",
    aliases: [
      "seo",
      "search rankings",
      "search ranking",
      "crawlable",
      "crawlability",
      "indexation",
      "indexing",
      "structured data",
      "schema.org",
      "meta tags",
      "sitemap",
      "organic traffic",
      "organic search",
    ],
  },
  {
    term: "core web vitals",
    aliases: ["lighthouse", "web vitals", "lcp", "cls", "inp", "page speed", "pagespeed"],
  },
  {
    term: "semantic html",
    aliases: ["semantic markup", "html5", "semantic elements", "landmarks"],
  },
  {
    term: "design system",
    aliases: [
      "design systems",
      "component library",
      "ui library",
      "shared components",
      "shared ui",
      "design language",
      "component package",
      "pattern library",
      "storybook",
    ],
  },
  {
    term: "reusable components",
    aliases: [
      "shared components",
      "component library",
      "shared ui package",
      "reusable ui",
      "ui primitives",
    ],
  },
  {
    term: "shared libraries",
    aliases: [
      "shared package",
      "shared packages",
      "internal packages",
      "shared ui package",
      "monorepo",
    ],
  },
  {
    term: "component architecture",
    aliases: [
      "how the components were structured",
      "component structure",
      "frontend architecture",
      "structured the front end",
      "how the front end is structured",
    ],
  },
  {
    term: "state management",
    aliases: ["application state", "redux", "zustand", "mobx", "client state", "state was managed"],
  },
  {
    term: "responsive ui",
    aliases: [
      "responsive",
      "mobile-first",
      "mobile first",
      "worked on phones",
      "any screen",
      "adaptive layout",
      "breakpoints",
    ],
  },
  {
    term: "customer-facing applications",
    aliases: [
      "customer facing",
      "consumer-facing",
      "consumer facing",
      "user-facing",
      "public-facing",
      "customer journey",
      "consumer product",
      "consumer products",
      "end users",
    ],
  },
  {
    term: "internal tools",
    aliases: [
      "internal tooling",
      "back-office",
      "back office",
      "admin tool",
      "admin tools",
      "admin tooling",
      "operations tooling",
      "internal platform",
    ],
  },
  {
    term: "application performance",
    aliases: [
      "performance",
      "load time",
      "page weight",
      "faster",
      "latency",
      "bundle size",
      "time to first",
      "speed",
    ],
  },
  {
    term: "reliability",
    aliases: ["error rate", "error rates", "uptime", "stability", "incidents", "resilience"],
  },
  {
    term: "developer experience",
    aliases: [
      "dx",
      "tooling for engineers",
      "build times",
      "developer tooling",
      "productivity",
      "shared ui package",
      "other squads build against",
      "internal library",
      "scaffolding",
    ],
  },
  {
    term: "experimentation",
    aliases: ["a/b test", "a/b testing", "a/b tests", "ab testing", "split testing", "experiments"],
  },
  {
    term: "continuous improvement",
    aliases: ["iterated", "iteration", "incremental improvement", "kaizen"],
  },
  {
    term: "testing",
    aliases: [
      "tests",
      "test suite",
      "unit tests",
      "integration tests",
      "end-to-end",
      "e2e",
      "jest",
      "vitest",
      "playwright",
      "cypress",
      "testing library",
    ],
  },
  {
    term: "ci/cd",
    aliases: [
      "continuous integration",
      "continuous delivery",
      "pipeline",
      "pipelines",
      "github actions",
      "gitlab ci",
      "jenkins",
      "deploys",
      "deployment pipeline",
    ],
  },
  {
    term: "agile",
    aliases: [
      "scrum",
      "kanban",
      "sprints",
      "two-week iterations",
      "iterations",
      "stand-ups",
      "standups",
    ],
  },
  {
    term: "git",
    aliases: ["github", "gitlab", "version control", "pull requests", "code review", "merge"],
  },
  {
    term: "ownership",
    aliases: ["owned", "own", "end to end", "end-to-end", "took responsibility", "led", "drove"],
  },
  {
    term: "collaboration",
    aliases: [
      "worked with",
      "partnered with",
      "cross-functional",
      "cross functional",
      "alongside",
      "with product",
      "with design",
      "with marketing",
      "with backend",
      "designers",
      "product managers",
      "stakeholders",
      "other squads",
      "other teams",
      "pairing",
    ],
  },
  {
    term: "fintech",
    aliases: [
      "financial",
      "banking",
      "bank",
      "banks",
      "payments",
      "payment provider",
      "lending",
      "insurance",
      "trading",
    ],
  },
  {
    term: "regulated industry",
    aliases: [
      "regulated",
      "compliance",
      "gdpr",
      "kyc",
      "aml",
      "audited",
      "financial regulation",
      "privacy-sensitive",
      "healthcare",
      // These industries are regulated by definition, and a CV says the
      // industry rather than the fact.
      "bank",
      "banks",
      "banking",
      "payment provider",
      "payments",
      "lending",
      "insurance",
    ],
  },
  { term: "graphql", aliases: ["apollo", "graph api", "graphql api", "graphql apis"] },
  { term: "next.js", aliases: ["nextjs", "next js", "app router", "pages router"] },
  { term: "typescript", aliases: ["ts", "typed javascript"] },
  { term: "react", aliases: ["react.js", "reactjs"] },
];

const BY_TERM = new Map(EQUIVALENCES.map((entry) => [entry.term, entry.aliases]));

/**
 * Every spelling that counts as evidence for a phrase.
 *
 * Matches on the whole phrase first, then on any equivalence whose term the
 * phrase contains — so "technical SEO" picks up the SEO aliases, and "strong
 * React and TypeScript" picks up both languages'.
 */
export function aliasesFor(phrase: string): string[] {
  const needle = phrase.toLowerCase().trim();
  const exact = BY_TERM.get(needle);
  if (exact) return [...exact];

  const found = new Set<string>();
  for (const entry of EQUIVALENCES) {
    if (needle === entry.term || needle.includes(entry.term)) {
      for (const alias of entry.aliases) found.add(alias);
    }
  }

  return [...found];
}
