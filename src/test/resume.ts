import { resumeSchema, type Resume } from "@/lib/resume/schema";

/**
 * The CV and the advert every tailoring test is written against.
 *
 * Chosen to make the interesting cases reachable: a skill that is evidenced in
 * the work (React), one that is only claimed in the list (Docker), one the
 * advert wants and the CV has never heard of (GraphQL), a bullet that opens
 * with a hedge, and a bullet with no outcome in it. A fixture where everything
 * matches would let a scorer that always answers 100 pass.
 */
export function sampleResume(): Resume {
  return resumeSchema.parse({
    personal: {
      fullName: "Ana Ribeiro",
      headline: "Frontend Engineer",
      email: "ana@example.com",
      location: "Berlin, Germany",
    },
    summary: {
      text: "Frontend engineer building product interfaces in React, with five years across music and marketplace teams.",
    },
    experience: [
      {
        id: "exp-loudly",
        company: "Loudly",
        role: "Frontend Engineer",
        startDate: "2021",
        endDate: "present",
        bullets: [
          { id: "bul-1", text: "Worked on frontend performance across the playback surface." },
          {
            id: "bul-2",
            text: "Built the subscription flow in React and shipped it to every market the product sells in.",
          },
        ],
      },
      {
        id: "exp-market",
        company: "Marketplace GmbH",
        role: "Junior Developer",
        startDate: "2019",
        endDate: "2021",
        bullets: [
          { id: "bul-3", text: "Maintained the checkout, reducing failed payments by 12%." },
        ],
      },
    ],
    education: [
      { id: "edu-1", institution: "Universidade de Lisboa", degree: "BSc Computer Science" },
    ],
    skills: [
      { id: "skl-front", name: "Frontend", skills: ["React", "TypeScript", "CSS"] },
      { id: "skl-tools", name: "Tooling", skills: ["Docker", "Git"] },
    ],
    projects: [],
    languages: [{ id: "lng-1", name: "Portuguese", level: "Native" }],
    certifications: [],
  });
}

export const SAMPLE_JOB = `Senior Frontend Engineer

We are a music streaming company looking for a senior frontend engineer.

Responsibilities
- Build and maintain product surfaces in React and TypeScript
- Own frontend performance across the streaming player
- Work with designers on accessible interfaces

Requirements
- 5+ years of experience building web products
- Strong React and TypeScript
- Experience with GraphQL APIs
- Accessibility is part of how you work; accessibility reviews are routine here

Nice to have
- Kubernetes
- Experience in the music industry
`;
