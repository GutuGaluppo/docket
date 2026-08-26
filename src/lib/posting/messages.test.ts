import { describe, expect, it } from "vitest";

import {
  POSTING_MESSAGES,
  STATUS_MESSAGES,
  blockedHostMessage,
  messageForStatus,
} from "./messages";

const everySentence = [
  ...Object.values(POSTING_MESSAGES),
  ...Object.values(STATUS_MESSAGES),
  blockedHostMessage("linkedin.com"),
  messageForStatus(418),
  messageForStatus(507),
  messageForStatus(204),
];

describe("the collection as a whole", () => {
  it("never shows the reader a status code or the protocol's vocabulary", () => {
    // The regression this exists for: "The site answered 405", which is true,
    // unactionable, and meaningless to someone who has never read an RFC.
    // "http" survives only where the reader typed it themselves, in a scheme.
    for (const sentence of everySentence) {
      expect(sentence, sentence).not.toMatch(/\d{3}/);
      expect(sentence, sentence).not.toMatch(
        /\b(status code|HTTP status|response code|request|header|redirect)\b/i,
      );
    }
  });

  it("writes whole sentences", () => {
    for (const sentence of everySentence) {
      // A domain opens the one sentence that names the site that refused.
      expect(sentence, sentence).toMatch(/^([A-Z]|[a-z0-9-]+\.[a-z]{2,})[^]*\.$/);
    }
  });

  it("offers the way out wherever the site is the one refusing", () => {
    // A wall the reader cannot climb — a login, a bot filter, a link that is
    // not a page — is only a dead end if nobody mentions the paste box.
    for (const status of [401, 403, 405, 406, 429, 501]) {
      expect(messageForStatus(status), String(status)).toMatch(/advert text/i);
    }
  });
});

describe("messageForStatus", () => {
  it("says the advert is gone rather than that the page is missing", () => {
    expect(messageForStatus(404)).toBe("That advert is no longer there.");
    expect(messageForStatus(410)).toMatch(/taken down/i);
  });

  it("names the site as the one having trouble for a 5xx", () => {
    for (const status of [500, 502, 503, 504]) {
      expect(messageForStatus(status), String(status)).toMatch(/trouble of its own/i);
    }
  });

  it("falls back by class for a status nobody wrote a sentence for", () => {
    expect(messageForStatus(418)).toMatch(/refused to show/i);
    expect(messageForStatus(599)).toMatch(/trouble of its own/i);
    expect(messageForStatus(204)).toMatch(/readable page/i);
  });

  it("suggests waiting, not retrying at once, when the site is turning readers away", () => {
    expect(messageForStatus(429)).toMatch(/wait a minute/i);
  });
});

describe("blockedHostMessage", () => {
  it("names the site that refused, so the sentence is not a mystery", () => {
    expect(blockedHostMessage("linkedin.com")).toMatch(/^linkedin\.com does not allow this\./);
  });
});
