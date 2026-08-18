import { describe, expect, it } from "vitest";

import { blockedHost, hostMatches, inspectPostingUrl } from "./url";

describe("hostMatches", () => {
  it("matches the domain and its subdomains, not a lookalike", () => {
    expect(hostMatches("linkedin.com", "linkedin.com")).toBe(true);
    expect(hostMatches("www.linkedin.com", "linkedin.com")).toBe(true);
    expect(hostMatches("notlinkedin.com", "linkedin.com")).toBe(false);
    expect(hostMatches("linkedin.com.evil.example", "linkedin.com")).toBe(false);
  });
});

describe("inspectPostingUrl", () => {
  it("accepts a bare host and assumes https", () => {
    const verdict = inspectPostingUrl("job-boards.greenhouse.io/loudly/jobs/1");
    expect(verdict.ok).toBe(true);
    if (verdict.ok) expect(verdict.url.protocol).toBe("https:");
  });

  it("strips credentials and the fragment", () => {
    const verdict = inspectPostingUrl("https://user:pass@example.com/jobs/1#apply");
    expect(verdict.ok).toBe(true);
    if (verdict.ok) {
      expect(verdict.url.username).toBe("");
      expect(verdict.url.password).toBe("");
      expect(verdict.url.hash).toBe("");
    }
  });

  it("refuses non-web schemes", () => {
    for (const raw of ["file:///etc/passwd", "ftp://example.com/a", "javascript:alert(1)"]) {
      const verdict = inspectPostingUrl(raw);
      expect(verdict.ok, raw).toBe(false);
    }
  });

  it("refuses literal private addresses without touching DNS", () => {
    for (const raw of [
      "http://169.254.169.254/latest/meta-data/",
      "http://127.0.0.1:5432",
      "http://10.0.0.5/",
      "http://[::1]/",
      "http://localhost:3000/",
    ]) {
      const verdict = inspectPostingUrl(raw);
      expect(verdict.ok, raw).toBe(false);
      if (!verdict.ok) expect(verdict.reason).toBe("private-host");
    }
  });

  it("names the boards that will not answer a server, and says what to do instead", () => {
    const verdict = inspectPostingUrl("https://www.linkedin.com/jobs/view/123456");
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.reason).toBe("blocked-host");
      expect(verdict.message).toMatch(/copy the advert text/i);
    }
    expect(blockedHost("uk.indeed.com")).toBe("indeed.com");
  });

  it("treats an empty box as a prompt, not an error", () => {
    const verdict = inspectPostingUrl("   ");
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toBe("empty");
  });
});
