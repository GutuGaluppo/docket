import { render } from "@react-email/components";
import { describe, expect, it } from "vitest";

import { FollowUpEmail } from "./FollowUpEmail";

const items = [
  { protocolNumber: 3, company: "Meridian Labs", position: "Senior Frontend Developer", daysWaiting: 21 },
  { protocolNumber: 7, company: "Kestrel", position: "Frontend Engineer", daysWaiting: 15 },
];
const props = { days: 14, settingsUrl: "https://x/settings", docketUrl: "https://x/docket" };

/**
 * Content is asserted against the plain-text render, not the HTML: React splits
 * adjacent text nodes with `<!-- -->`, so "21 days" never appears literally in
 * the markup even though every client shows it. The text version is also what
 * a reader with images and HTML off actually gets.
 */
const text = (over = {}) => render(FollowUpEmail({ items, ...props, ...over }), { plainText: true });
const html = (over = {}) => render(FollowUpEmail({ items, ...props, ...over }));

describe("FollowUpEmail", () => {
  it("names every application and how long it has waited", async () => {
    const out = await text();
    expect(out).toContain("Meridian Labs");
    expect(out).toContain("Senior Frontend Developer");
    expect(out).toContain("21 days");
    expect(out).toContain("Kestrel");
  });

  it("counts correctly in the plural", async () => {
    expect(await text()).toContain("2 applications have gone 14 days without an answer");
  });

  it("uses the singular for one", async () => {
    const out = await text({ items: [items[0]] });
    expect(out).toContain("One application has gone 14 days");
    expect(out).not.toContain("applications have gone");
  });

  it("always carries a way out", async () => {
    expect(await html()).toContain("https://x/settings");
    expect(await text()).toContain("Turn these off");
  });

  it("keeps the promise it makes about frequency", async () => {
    expect(await text()).toContain("One reminder per application, never a second.");
  });

  it("carries no stylesheet — clients strip them", async () => {
    expect(await html()).not.toContain("<style");
  });

  it("renders a usable plain-text alternative", async () => {
    const out = await text();
    expect(out.length).toBeGreaterThan(80);
    expect(out).not.toContain("<");
  });
});
