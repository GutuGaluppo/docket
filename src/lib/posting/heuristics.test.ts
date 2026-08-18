import { describe, expect, it } from "vitest";

import { draftFromPage, hostBrand, splitTitle } from "./heuristics";
import { splitLocation } from "./location";

describe("hostBrand", () => {
  it("drops the hiring subdomain and keeps the employer", () => {
    expect(hostBrand("careers.loudly.com")).toBe("loudly.com");
    expect(hostBrand("jobs.loudly.co.uk")).toBe("loudly.co.uk");
    expect(hostBrand("www.loudly.com")).toBe("loudly.com");
    expect(hostBrand("loudly.com")).toBe("loudly.com");
  });

  it("never strips down to a bare TLD", () => {
    expect(hostBrand("careers.com")).toBe("careers.com");
  });
});

describe("splitTitle", () => {
  it("takes the position from the front and the employer from the back", () => {
    expect(splitTitle("Senior Frontend Developer | Loudly")).toEqual({
      position: "Senior Frontend Developer",
      company: "Loudly",
    });
    expect(splitTitle("Data Engineer at Loudly")).toEqual({
      position: "Data Engineer",
      company: "Loudly",
    });
  });

  it("keeps the whole string as the position when there is no separator", () => {
    expect(splitTitle("Senior Frontend Developer")).toEqual({
      position: "Senior Frontend Developer",
      company: "",
    });
  });

  it("does not mistake a page section for an employer", () => {
    expect(splitTitle("Backend Developer — Careers")).toEqual({
      position: "Backend Developer",
      company: "",
    });
  });
});

describe("splitLocation", () => {
  it("reads city and country out of the one string a board gives", () => {
    expect(splitLocation("Berlin, Germany")).toEqual({ city: "Berlin", country: "Germany" });
    expect(splitLocation("Remote — Lisbon")).toMatchObject({ city: "Lisbon" });
    expect(splitLocation("London, UK (Hybrid)")).toMatchObject({ city: "London" });
  });

  it("deduces the country from a city it knows", () => {
    expect(splitLocation("Berlin")).toEqual({ city: "Berlin", country: "Germany" });
  });

  it("returns nothing rather than guessing at a place it cannot recognise", () => {
    expect(splitLocation("Remote")).toEqual({});
    expect(splitLocation("Somewhere Fictional")).toEqual({});
    expect(splitLocation("")).toEqual({});
  });
});

describe("draftFromPage", () => {
  const url = new URL("https://careers.loudly.com/jobs/42");

  it("reads what the page declared about itself", () => {
    const html = `<html><head>
      <title>Senior Frontend Developer | Loudly</title>
      <meta property="og:site_name" content="Loudly">
      <meta property="og:title" content="Senior Frontend Developer">
      </head><body><h1>Senior Frontend Developer</h1>
      <main>${"We use React, TypeScript and Next.js on the front end, with Node.js behind it. ".repeat(6)}</main>
      </body></html>`;
    const draft = draftFromPage(html, url);
    expect(draft.position).toBe("Senior Frontend Developer");
    expect(draft.company).toBe("Loudly");
    expect(draft.website).toBe("loudly.com");
    expect(draft.jobDescription).toContain("TypeScript");
  });

  it("takes a place only where the page labelled one", () => {
    const html = `<html><body><h1>QA Engineer</h1><main>${"x".repeat(300)}</main>
      <p>Location: Berlin, Germany</p></body></html>`;
    expect(draftFromPage(html, url)).toMatchObject({ city: "Berlin", country: "Germany" });

    const unlabelled = `<html><body><h1>QA Engineer</h1><main>${"We are in Berlin. ".repeat(30)}</main></body></html>`;
    expect(draftFromPage(unlabelled, url).city).toBeUndefined();
  });

  it("never puts a board's own domain in the website column", () => {
    const boarded = draftFromPage(
      "<html><body><h1>Ops</h1></body></html>",
      new URL("https://job-boards.greenhouse.io/loudly/jobs/1"),
    );
    expect(boarded.website).toBeUndefined();
  });

  it("leaves the description empty rather than filling it with page chrome", () => {
    const html = `<html><body><nav>Home About Cookies</nav><h1>Ops</h1><div>short</div></body></html>`;
    expect(draftFromPage(html, url).jobDescription).toBeUndefined();
  });
});
