import { render } from "@react-email/components";
import { describe, expect, it } from "vitest";

import { ContactEmail } from "./ContactEmail";

const props = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  subject: "Question about Docket",
  message: "Could you help me with my account?\nThank you.",
  userId: "user-42",
};

describe("ContactEmail", () => {
  it("includes the sender and their message", async () => {
    const out = await render(ContactEmail(props), { plainText: true });
    expect(out).toContain("Ada Lovelace");
    expect(out).toContain("ada@example.com");
    expect(out).toContain("Question about Docket");
    expect(out).toContain("Could you help me with my account?");
    expect(out).toContain("user-42");
  });

  it("omits the account row for public visitors", async () => {
    const out = await render(ContactEmail({ ...props, userId: undefined }), { plainText: true });
    expect(out).not.toContain("Docket user");
  });

  it("escapes content supplied by the sender", async () => {
    const out = await render(ContactEmail({ ...props, message: "<script>alert('x')</script>" }));
    expect(out).not.toContain("<script>");
    expect(out).toContain("&lt;script&gt;");
  });

  it("uses inline styles instead of a stylesheet", async () => {
    expect(await render(ContactEmail(props))).not.toContain("<style");
  });
});
