/**
 * Who operates Docket. One source of truth for the three legal pages and the
 * footer, so the controller named in the privacy policy can never drift from
 * the one named in the Impressum.
 */
export const OPERATOR = {
  name: "Augusto Galuppo",
  form: "individual" as const,
  email: "galuppodev@gmail.com",
  city: "Berlin",
  country: "Germany",
  /**
   * §5 DDG requires a ladungsfähige Anschrift — an address where documents can
   * physically be served. A PO box does not satisfy it.
   *
   * Empty on purpose: an Impressum missing the address is not a partial
   * Impressum, it is a non-compliant one that looks compliant. While this is
   * blank the page refuses to publish and the footer link does not appear.
   */
  street: "",
  postalCode: "",
} as const;

export const IMPRESSUM_READY = OPERATOR.street !== "" && OPERATOR.postalCode !== "";

/** Berlin's supervisory authority, for the art. 77 right to complain. */
export const SUPERVISORY_AUTHORITY = {
  name: "Berliner Beauftragte für Datenschutz und Informationsfreiheit",
  url: "https://www.datenschutz-berlin.de",
};

export const LAST_UPDATED = "18 August 2026";

/**
 * Everyone who processes data on our behalf, and where. All of it stays inside
 * the EU, which is what removes the international-transfer question entirely.
 */
export const SUBPROCESSORS = [
  { name: "Vercel", role: "Hosting and delivery of the application", where: "Frankfurt, Germany" },
  { name: "Neon", role: "The database where the register is stored", where: "Frankfurt, Germany" },
  { name: "Resend", role: "Sending the follow-up emails you asked for", where: "Ireland" },
  {
    name: "PostHog",
    role: "Counting the six product events listed above",
    where: "Germany (EU cloud)",
  },
  { name: "Google", role: "Sign-in, if you choose it", where: "Depends on your Google account" },
  { name: "GitHub", role: "Sign-in, if you choose it", where: "Depends on your GitHub account" },
] as const;
