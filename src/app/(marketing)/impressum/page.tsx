import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Clause, LegalPage } from "@/components/legal/Prose";
import { IMPRESSUM_READY, LAST_UPDATED, OPERATOR } from "@/lib/legal";

export const metadata: Metadata = {
  title: { absolute: "Impressum — Docket" },
  description: "Anbieterkennzeichnung nach §5 DDG.",
  alternates: { canonical: "/impressum" },
};

/**
 * §5 DDG requires a servable postal address. Until OPERATOR.street and
 * postalCode are filled in, this page returns 404 and the footer omits the
 * link — an Impressum missing the address is not a partial one, it is a
 * non-compliant page that looks compliant, which is worse than its absence.
 */
export default function ImpressumPage() {
  if (!IMPRESSUM_READY) notFound();

  return (
    <LegalPage
      eyebrow="Impressum"
      title="Anbieterkennzeichnung"
      intro="Angaben gemäß §5 DDG."
      updated={LAST_UPDATED}
    >
      <Clause heading="Diensteanbieter">
        <p>
          {OPERATOR.name}
          <br />
          {OPERATOR.street}
          <br />
          {OPERATOR.postalCode} {OPERATOR.city}
          <br />
          {OPERATOR.country}
        </p>
      </Clause>

      <Clause heading="Kontakt">
        <p>
          E-Mail:{" "}
          <a href={`mailto:${OPERATOR.email}`} className="border-b border-stamp text-ink">
            {OPERATOR.email}
          </a>
        </p>
      </Clause>

      <Clause heading="Verantwortlich für den Inhalt">
        <p>
          {OPERATOR.name}, Anschrift wie oben. Docket wird als Einzelperson betrieben; eine
          Umsatzsteuer-Identifikationsnummer liegt nicht vor.
        </p>
      </Clause>

      <Clause heading="Verbraucherstreitbeilegung">
        <p>
          Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer
          Verbraucherschlichtungsstelle teilzunehmen.
        </p>
      </Clause>
    </LegalPage>
  );
}
