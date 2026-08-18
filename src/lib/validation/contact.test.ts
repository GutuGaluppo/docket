import { describe, expect, it } from "vitest";

import { contactSchema } from "./contact";

const valid = {
  name: "Ada Lovelace",
  email: "candidate@example.com",
  subject: "Question about my account",
  message: "Could you help me with my account settings?",
  company: "",
};

describe("contactSchema", () => {
  it("trims valid contact details", () => {
    const result = contactSchema.parse({
      ...valid,
      email: " candidate@example.com ",
      subject: " Question about my account ",
    });

    expect(result.email).toBe("candidate@example.com");
    expect(result.subject).toBe("Question about my account");
  });

  it("rejects malformed email addresses", () => {
    expect(contactSchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
  });

  it("rejects a missing sender name", () => {
    expect(contactSchema.safeParse({ ...valid, name: " " }).success).toBe(false);
  });

  it("rejects messages too short to be actionable", () => {
    expect(contactSchema.safeParse({ ...valid, message: "Help" }).success).toBe(false);
  });

  it("rejects a filled honeypot", () => {
    expect(contactSchema.safeParse({ ...valid, company: "Spam Ltd" }).success).toBe(false);
  });
});
