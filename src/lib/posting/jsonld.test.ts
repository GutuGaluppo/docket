import { describe, expect, it } from "vitest";

import { jsonLdBlocks } from "./html";
import { draftFromJsonLd, findJobPostings } from "./jsonld";

const PAGE = `
<html><head>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"WebSite","name":"Careers"}
</script>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"JobPosting",
 "title":"Senior Frontend Developer",
 "description":"<p>You will work with <b>React</b>, TypeScript and Next.js.</p>",
 "hiringOrganization":{"@type":"Organization","name":"Loudly","sameAs":"https://www.loudly.com/"},
 "jobLocation":{"@type":"Place","address":{"@type":"PostalAddress","addressLocality":"Berlin","addressCountry":"Germany"}}}
</script>
</head><body></body></html>`;

describe("draftFromJsonLd", () => {
  it("reads the fields the register asks for out of a JobPosting block", () => {
    const draft = draftFromJsonLd(jsonLdBlocks(PAGE));
    expect(draft.position).toBe("Senior Frontend Developer");
    expect(draft.company).toBe("Loudly");
    expect(draft.website).toBe("loudly.com");
    expect(draft.city).toBe("Berlin");
    expect(draft.country).toBe("Germany");
    expect(draft.jobDescription).toContain("React");
    expect(draft.jobDescription).not.toContain("<p>");
  });

  it("finds a posting nested inside @graph", () => {
    const found = findJobPostings({
      "@graph": [{ "@type": "Organization" }, { "@type": "JobPosting", title: "Data Engineer" }],
    });
    expect(found).toHaveLength(1);
    expect(found[0]?.title).toBe("Data Engineer");
  });

  it("accepts @type given as an array", () => {
    expect(findJobPostings({ "@type": ["Thing", "JobPosting"], title: "QA" })).toHaveLength(1);
  });

  it("drops a two-letter country code rather than storing it as a country name", () => {
    const draft = draftFromJsonLd([
      JSON.stringify({
        "@type": "JobPosting",
        title: "Backend Developer",
        jobLocation: { address: { addressLocality: "Lisbon", addressCountry: "PT" } },
      }),
    ]);
    expect(draft.city).toBe("Lisbon");
    expect(draft.country).toBe("");
  });

  it("survives a page whose block is not valid JSON", () => {
    expect(draftFromJsonLd(["{ not json", '{"@type":"JobPosting","title":"Ops"}'])).toMatchObject({
      position: "Ops",
    });
    expect(draftFromJsonLd(["{ not json"])).toEqual({});
  });

  it("prefers the block that answers the most fields", () => {
    const draft = draftFromJsonLd([
      JSON.stringify({ "@type": "JobPosting", title: "Thin" }),
      JSON.stringify({
        "@type": "JobPosting",
        title: "Full",
        hiringOrganization: { name: "Loudly" },
        description: "React",
      }),
    ]);
    expect(draft.position).toBe("Full");
  });
});
