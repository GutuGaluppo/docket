import { describe, expect, it } from "vitest";

import { mergeDraft } from "./merge";

describe("mergeDraft", () => {
  it("lets a later layer fill a gap but never overwrite an earlier one", () => {
    const draft = mergeDraft([
      { source: "Greenhouse", partial: { position: "Senior Frontend Developer" } },
      { source: "structured data", partial: { position: "WRONG", company: "Loudly" } },
      { source: "page text", partial: { company: "ALSO WRONG", website: "loudly.com" } },
    ]);
    expect(draft.values.position).toBe("Senior Frontend Developer");
    expect(draft.values.company).toBe("Loudly");
    expect(draft.values.website).toBe("loudly.com");
  });

  it("reports exactly the fields it filled, so the form marks those and no others", () => {
    const draft = mergeDraft([{ source: "Lever", partial: { position: "QA", company: "" } }]);
    expect(draft.filled).toEqual(["position"]);
    expect(draft.values.company).toBe("");
  });

  it("names only the layers that actually contributed", () => {
    const draft = mergeDraft([
      { source: "Greenhouse", partial: { position: "QA" } },
      { source: "page text", partial: { position: "ignored" } },
    ]);
    expect(draft.sources).toEqual(["Greenhouse"]);
  });

  it("carries the country along with a city it recognises", () => {
    const draft = mergeDraft([{ source: "Lever", partial: { city: "Berlin" } }]);
    expect(draft.values.country).toBe("Germany");
    expect(draft.filled).toContain("country");
  });

  it("does not override a country the advert stated itself", () => {
    const draft = mergeDraft([
      { source: "structured data", partial: { city: "Berlin", country: "Deutschland" } },
    ]);
    expect(draft.values.country).toBe("Deutschland");
  });

  it("normalises a website however the page wrote it", () => {
    const draft = mergeDraft([
      { source: "page text", partial: { website: "https://www.loudly.com/careers" } },
    ]);
    expect(draft.values.website).toBe("loudly.com");
  });

  it("caps a runaway description instead of handing the form a novel", () => {
    const draft = mergeDraft([
      { source: "page text", partial: { jobDescription: "React ".repeat(6_000) } },
    ]);
    expect(draft.values.jobDescription.length).toBeLessThanOrEqual(12_001);
    expect(draft.values.jobDescription.endsWith("…")).toBe(true);
  });

  it("returns nothing filled when no layer found anything", () => {
    expect(mergeDraft([]).filled).toEqual([]);
    expect(mergeDraft([{ source: "page text", partial: { position: "   " } }]).filled).toEqual([]);
  });
});
