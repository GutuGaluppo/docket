import { resumeSchema, type Resume } from "@/lib/resume/schema";

/**
 * The benchmark: one job advert, three CVs written against it on purpose.
 *
 * A scorer can only be judged against documents whose answer is known before
 * the run. These three are that: one that plainly does not fit, one that half
 * fits, and one written to contain nearly every requirement explicitly. The
 * bands they are expected to land in are stated in the tests, not here — the
 * fixtures are the evidence, and the thresholds are the claim being tested.
 */

export const BENCHMARK_JOB = `Senior Frontend Engineer

We are a fintech company building customer-facing applications and internal
tools for a regulated financial market. You will own significant parts of the
product surface end to end.

What you will do
- Build customer-facing applications in React, TypeScript and Next.js
- Build and maintain internal tools used across the company
- Work with GraphQL APIs
- Collaborate with Product, Design, Marketing and Backend engineers
- Own component architecture, state management and application state
- Build responsive UI and accessible UI for every screen we ship
- Create reusable components, shared libraries and design systems
- Improve application performance, reliability and developer experience
- Own technical SEO: Core Web Vitals, SSR, crawlability, structured data,
  indexation and semantic HTML
- Run experimentation and continuous improvement across the funnel

About you
- Strong commercial experience with React and TypeScript
- Strong experience with Next.js and modern rendering strategies
- Comfortable with GraphQL
- You write tests, you use Git, and you work with CI/CD in an Agile team
- You care about accessibility and about performance
- You have ownership of what you ship

Added bonus
- Observability tooling such as Grafana or Honeycomb
- Experience in fintech or another regulated industry
`;

/**
 * The near-perfect CV: nearly every requirement, written the way a person
 * writes their own CV.
 *
 * Deliberately **not** a copy of the advert's sentences. A candidate who has
 * done all of this says "shipped consumer-facing products", not "build
 * customer-facing applications"; "server-rendered pages" rather than "SSR";
 * "monitoring dashboards" rather than "observability". A scorer that only
 * rewards the advert's own wording is a scorer that rewards copy-and-paste, so
 * this fixture is the one that decides whether the matching is semantic.
 */
export function nearPerfectResume(): Resume {
  return resumeSchema.parse({
    personal: {
      fullName: "Ana Ribeiro",
      headline: "Senior Frontend Engineer",
      email: "ana@example.com",
      location: "Berlin, Germany",
    },
    summary: {
      text: "Senior frontend engineer, eight years shipping consumer-facing products and internal admin tooling for banks and payment providers. I work in React with TypeScript on Next.js, own how the front end is structured and how its state is managed, and care about pages that load fast, work on any screen and are usable with a keyboard and a screen reader.",
    },
    experience: [
      {
        id: "exp-fin",
        company: "Zopa",
        role: "Senior Frontend Engineer",
        startDate: "2021",
        endDate: "Present",
        current: true,
        bullets: [
          {
            id: "bul-1",
            text: "Shipped the consumer lending journey end to end in React and TypeScript on Next.js, deciding how the components were structured and how application state was managed across the flow.",
          },
          {
            id: "bul-2",
            text: "Built the back-office tooling the operations team uses every day, talking to the platform's GraphQL API.",
          },
          {
            id: "bul-3",
            text: "Took the search rankings from a server-rendered rebuild: fixed what Lighthouse called out, got the pages crawlable, added schema.org markup and rewrote the templates in semantic markup.",
          },
          {
            id: "bul-4",
            text: "Cut page weight and load time across the funnel, reduced error rates, and set up the shared UI package the other squads build against.",
          },
          {
            id: "bul-5",
            text: "Set up the dashboards and tracing the team watches in production, and ran the A/B programme with the product and marketing folks.",
          },
          {
            id: "bul-6",
            text: "Wrote the test suite that guards the checkout, kept the pipeline green on every merge, and worked in two-week iterations with design and the backend engineers.",
          },
        ],
      },
      {
        id: "exp-health",
        company: "SuperVista",
        role: "Frontend Engineer",
        startDate: "2018",
        endDate: "2021",
        bullets: [
          {
            id: "bul-7",
            text: "Rebuilt the booking flow so it worked on phones and with assistive technology, in React and TypeScript.",
          },
          {
            id: "bul-8",
            text: "Extracted the pieces every team was re-writing into one component package, which became the company's design language.",
          },
        ],
      },
    ],
    education: [
      { id: "edu-1", institution: "Universidade de Lisboa", degree: "BSc Computer Science" },
    ],
    skills: [
      {
        id: "skl-front",
        name: "Frontend",
        skills: ["React", "TypeScript", "Next.js", "GraphQL", "HTML", "CSS"],
      },
      {
        id: "skl-practice",
        name: "Ways of working",
        skills: ["Testing", "Git", "CI/CD", "Scrum", "A/B testing"],
      },
      { id: "skl-tools", name: "Tooling", skills: ["Grafana", "Honeycomb", "Lighthouse"] },
    ],
    projects: [],
    languages: [{ id: "lng-1", name: "Portuguese", level: "Native" }],
    certifications: [],
  });
}

/**
 * The same CV with the advert's own words pasted back into it.
 *
 * Exists to be compared against the one above: a scorer that prefers this one
 * by a wide margin is rewarding copy-and-paste rather than experience.
 */
export function echoResume(): Resume {
  const base = nearPerfectResume();
  return resumeSchema.parse({
    ...base,
    summary: {
      text: "Senior frontend engineer with commercial experience building customer-facing applications and internal tools in React, TypeScript and Next.js for fintech and other regulated industries. I own component architecture, state management, accessible UI, responsive UI, technical SEO, Core Web Vitals, SSR, crawlability, structured data, indexation, semantic HTML, application performance, reliability and developer experience, and I work with Product, Design, Marketing and Backend.",
    },
  });
}

/**
 * Half of it: the languages and some of the ways of working, none of the
 * specialisms, none of the domain.
 *
 * The CV of somebody who could do the job in a year and cannot do it today.
 */
export function partialResume(): Resume {
  return resumeSchema.parse({
    personal: {
      fullName: "Bruno Costa",
      headline: "Frontend Developer",
      email: "bruno@example.com",
      location: "Lisbon, Portugal",
    },
    summary: {
      text: "Frontend developer, four years building web applications for agency clients and their customers in React and TypeScript.",
    },
    experience: [
      {
        id: "exp-agency",
        company: "Agência Web",
        role: "Frontend Developer",
        startDate: "2020",
        endDate: "2024",
        bullets: [
          {
            id: "bul-a",
            text: "Built customer-facing marketing sites and a booking product in React and TypeScript, on Next.js for the last two of them.",
          },
          {
            id: "bul-b",
            text: "Kept the shared component package the two squads build against, and fixed the layouts that broke on phones.",
          },
          {
            id: "bul-c",
            text: "Wrote the tests for the booking flow and kept the deploy pipeline green, working in two-week sprints with the designers.",
          },
        ],
      },
    ],
    education: [{ id: "edu-b", institution: "ISCTE", degree: "BSc Information Systems" }],
    skills: [
      {
        id: "skl-b",
        name: "Skills",
        skills: ["React", "TypeScript", "Next.js", "CSS", "Git", "Jest"],
      },
    ],
    projects: [],
    languages: [],
    certifications: [],
  });
}

/** A different profession entirely. */
export function poorResume(): Resume {
  return resumeSchema.parse({
    personal: {
      fullName: "Carla Mendes",
      headline: "Registered Nurse",
      email: "carla@example.com",
      location: "Porto, Portugal",
    },
    summary: {
      text: "Registered nurse with eight years in intensive care, specialised in post-operative recovery and patient education.",
    },
    experience: [
      {
        id: "exp-hosp",
        company: "Hospital de São João",
        role: "Registered Nurse",
        startDate: "2016",
        endDate: "Present",
        current: true,
        bullets: [
          {
            id: "bul-c",
            text: "Cared for post-operative patients in a twenty-bed intensive care unit.",
          },
          {
            id: "bul-d",
            text: "Trained junior nurses on medication protocols and patient handover.",
          },
        ],
      },
    ],
    education: [
      { id: "edu-c", institution: "Escola Superior de Enfermagem", degree: "BSc Nursing" },
    ],
    skills: [
      { id: "skl-c", name: "Clinical", skills: ["Intensive care", "Triage", "Patient education"] },
    ],
    projects: [],
    languages: [],
    certifications: [],
  });
}
