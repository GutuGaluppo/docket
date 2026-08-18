import { describe, expect, it } from "vitest";

import { adapterFor, isBoardHost } from "./adapters";

const at = (raw: string) => adapterFor(new URL(raw));

describe("adapterFor", () => {
  it("routes a Greenhouse board link to the board API", () => {
    const found = at("https://job-boards.greenhouse.io/loudly/jobs/4820193");
    expect(found?.adapter.source).toBe("Greenhouse");
    expect(found?.endpoint).toBe(
      "https://boards-api.greenhouse.io/v1/boards/loudly/jobs/4820193?content=true",
    );
  });

  it("recognises the older boards.greenhouse.io host and the embed form", () => {
    expect(at("https://boards.greenhouse.io/loudly/jobs/1")?.adapter.source).toBe("Greenhouse");
    expect(at("https://boards.greenhouse.io/embed/job_app?for=loudly&token=99")?.endpoint).toBe(
      "https://boards-api.greenhouse.io/v1/boards/loudly/jobs/99?content=true",
    );
  });

  it("routes Lever and Ashby", () => {
    expect(at("https://jobs.lever.co/loudly/abc-123")?.endpoint).toBe(
      "https://api.lever.co/v0/postings/loudly/abc-123",
    );
    expect(at("https://jobs.ashbyhq.com/loudly/uuid-1")?.endpoint).toBe(
      "https://api.ashbyhq.com/posting-api/job-board/loudly",
    );
  });

  it("ignores a board host without a posting path, and unrelated hosts", () => {
    expect(at("https://job-boards.greenhouse.io/loudly")).toBeNull();
    expect(at("https://careers.loudly.com/jobs/1")).toBeNull();
    expect(at("https://greenhouse.io.evil.example/loudly/jobs/1")).toBeNull();
  });

  it("percent-encodes the pieces it lifts out of the path", () => {
    expect(at("https://jobs.lever.co/a%2Fb/c%20d")?.endpoint).toBe(
      "https://api.lever.co/v0/postings/a%2Fb/c%20d",
    );
  });
});

describe("Greenhouse parser", () => {
  it("reads title, entity-encoded content and location", () => {
    const found = at("https://job-boards.greenhouse.io/loudly/jobs/1");
    const draft = found?.adapter.parse(
      {
        title: "Senior Frontend Developer",
        company_name: "Loudly",
        content: "&lt;p&gt;You will use &lt;b&gt;React&lt;/b&gt; and TypeScript.&lt;/p&gt;",
        location: { name: "Berlin, Germany" },
      },
      new URL("https://job-boards.greenhouse.io/loudly/jobs/1"),
    );
    expect(draft?.position).toBe("Senior Frontend Developer");
    expect(draft?.company).toBe("Loudly");
    expect(draft?.jobDescription).toContain("React");
    expect(draft?.jobDescription).not.toContain("<b>");
    expect(draft?.city).toBe("Berlin");
    expect(draft?.country).toBe("Germany");
  });
});

describe("Lever parser", () => {
  it("prefers the plain description and falls back to the company slug", () => {
    const url = new URL("https://jobs.lever.co/loudly-inc/abc");
    const found = adapterFor(url);
    const draft = found?.adapter.parse(
      {
        text: "Backend Engineer",
        descriptionPlain: "Go, PostgreSQL and Kubernetes.",
        categories: { location: "Lisbon" },
      },
      url,
    );
    expect(draft?.position).toBe("Backend Engineer");
    expect(draft?.company).toBe("loudly inc");
    expect(draft?.jobDescription).toContain("PostgreSQL");
    expect(draft?.city).toBe("Lisbon");
  });
});

describe("Ashby parser", () => {
  it("picks the posting whose id matches the link", () => {
    const url = new URL("https://jobs.ashbyhq.com/loudly/uuid-2");
    const draft = adapterFor(url)?.adapter.parse(
      {
        jobs: [
          { id: "uuid-1", title: "Wrong one", location: "Paris" },
          { id: "uuid-2", title: "Data Engineer", location: "Berlin, Germany" },
        ],
      },
      url,
    );
    expect(draft?.position).toBe("Data Engineer");
    expect(draft?.city).toBe("Berlin");
  });

  it("contributes nothing rather than something wrong when the shape is unfamiliar", () => {
    const url = new URL("https://jobs.ashbyhq.com/loudly/uuid-2");
    expect(adapterFor(url)?.adapter.parse({ postings: [] }, url)).toEqual({});
    expect(adapterFor(url)?.adapter.parse(null, url)).toEqual({});
  });
});

describe("isBoardHost", () => {
  it("knows a board domain from an employer domain", () => {
    expect(isBoardHost("job-boards.greenhouse.io")).toBe(true);
    expect(isBoardHost("loudly.myworkdayjobs.com")).toBe(true);
    expect(isBoardHost("careers.loudly.com")).toBe(false);
  });
});
