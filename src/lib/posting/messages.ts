/**
 * Everything the link box can say when a paste does not work out.
 *
 * The sentences live here, in one pure module, for two reasons. The first is
 * voice: a refusal is the only moment this feature talks to the person, and the
 * copy drifts apart when each layer writes its own. The second is audience.
 * A status line — "The site answered 405" — is precise and useless: it names
 * the protocol's opinion rather than the reader's situation, and the reader is
 * someone applying for a job, not someone debugging a server. Every sentence
 * below says what happened in plain words and, where a way forward exists,
 * names it: almost always pasting the advert text into the field underneath,
 * which the stack detector has always been able to read.
 *
 * Two rules hold the collection together. Nothing here reports a number, a
 * header or a verb — the failure `reason` already carries the machine-readable
 * half, and it is what logs and tests assert on. And no sentence blames the
 * reader for a link they merely copied.
 */

/** Refusals that do not depend on what a server said. */
export const POSTING_MESSAGES = {
  empty: "Paste the link to the job advert.",
  malformed: "That does not look like a link.",
  tooLong: "That link is too long to be real.",
  scheme: "Only http and https links can be read.",
  privateAddress: "That address is on a private network. Paste a public link.",
  privateHost: "That link leads to a private network, not to a public advert.",
  unknownHost: "No site answered at that address. Check the link for a typo.",
  unreachable: "That site could not be reached. Try again in a moment.",
  forwardsNowhere: "That link forwards to a page that is not there.",
  forwardsUnreadable: "That link forwards somewhere that cannot be read.",
  forwardsOffTheWeb: "That link forwards to something that is not a web page.",
  forwardsInCircles: "That link keeps forwarding and never arrives at a page.",
  tooLarge: "That page is too heavy to read. Copy the advert text into the field below instead.",
  nothingFound: "Nothing readable on that page. Paste the advert text below instead.",
  signedOut: "Sign in first.",
  throttled: "One link at a time — try again shortly.",
} as const satisfies Record<string, string>;

/** A board that refuses server-side reads: the one refusal that names its site. */
export function blockedHostMessage(domain: string): string {
  return `${domain} does not allow this. Copy the advert text into the field below instead — the tags still work.`;
}

const COPY_INSTEAD = "Copy the advert text into the field below instead.";
const COPY_INSTEAD_CLAUSE = "copy the advert text into the field below instead.";

/**
 * What each answer from a job site means to the person who pasted the link.
 *
 * Only the statuses a job advert realistically returns are written out. The
 * rest fall to the class fallbacks below, which is the honest answer: a status
 * nobody has seen here does not deserve invented advice.
 */
export const STATUS_MESSAGES: Readonly<Record<number, string>> = {
  400: "The site did not understand that address. Check the link and try again.",
  401: `That advert is behind a login. ${COPY_INSTEAD}`,
  403: `The site only shows that page to a browser, not to Docket. ${COPY_INSTEAD}`,
  404: "That advert is no longer there.",
  405: `That link is not a page that can be read on its own. Open it in the browser and ${COPY_INSTEAD_CLAUSE}`,
  406: `The site has nothing at that link that can be read. ${COPY_INSTEAD}`,
  408: "The site took too long to answer. Try again in a moment.",
  410: "That advert was taken down.",
  429: `The site is turning away readers right now. Wait a minute, or ${COPY_INSTEAD_CLAUSE}`,
  451: "The site does not serve that page in this part of the world.",
  501: `The site has nothing at that link that can be read. ${COPY_INSTEAD}`,
};

/** The sentence for an HTTP status, for a reader who has never heard of one. */
export function messageForStatus(status: number): string {
  const known = STATUS_MESSAGES[status];
  if (known) return known;
  if (status >= 500) return "The site is having trouble of its own. Try again in a few minutes.";
  if (status >= 400) return `The site refused to show that page. ${COPY_INSTEAD}`;
  return `That link did not lead to a readable page. ${COPY_INSTEAD}`;
}
