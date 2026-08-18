import type { Metadata } from "next";
import Link from "next/link";

import { Clause, LegalPage } from "@/components/legal/Prose";
import { IMPRESSUM_READY, LAST_UPDATED, OPERATOR } from "@/lib/legal";

export const metadata: Metadata = {
  title: { absolute: "Terms — Docket" },
  description: "The agreement between you and Docket: what it does, what it does not promise.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Terms"
      title="The agreement"
      intro="Short, because the service is small and free. Using Docket means accepting what follows."
      updated={LAST_UPDATED}
    >
      <Clause heading="Who you are agreeing with">
        <p>
          {OPERATOR.name}, a private individual in {OPERATOR.city}, {OPERATOR.country}.
          {IMPRESSUM_READY && (
            <>
              {" "}
              The details are in the{" "}
              <Link href="/impressum" className="border-b border-stamp text-ink">
                Impressum
              </Link>
              .
            </>
          )}{" "}
          German law applies.
        </p>
      </Clause>

      <Clause heading="What Docket does">
        <p>
          It keeps a numbered record of the jobs you applied for, reads technologies out of the
          advertisements you paste, and lets you move entries through stages, schedule interviews and
          export everything. That is the whole of it.
        </p>
      </Clause>

      <Clause heading="Your account">
        <p>
          You sign in with Google or GitHub, so the security of that account is the security of this
          one. You are responsible for what you put in the register, and for having the right to
          store it. Do not use Docket for anything unlawful, and do not attempt to reach another
          person&rsquo;s data.
        </p>
      </Clause>

      <Clause heading="What this record is not">
        <p>
          Docket writes down what you tell it, with the date and time you told it. That is a personal
          record, not an official document, and nobody is obliged to accept it as proof of anything.
          The export is often useful when demonstrating a job search — to the Jobcenter or the
          Agentur für Arbeit, for instance — but whether it is accepted is between you and them.
        </p>
      </Clause>

      <Clause heading="No promises about availability">
        <p>
          The service is free and provided as it is. There is no uptime guarantee, no support
          commitment, and features may change or disappear. Keep your own copy: the export exists for
          exactly this reason and takes one click.
        </p>
      </Clause>

      <Clause heading="Liability">
        <p>
          Liability is unlimited for injury to life, body or health, and for damage caused
          intentionally or through gross negligence. For simple negligence, liability arises only
          from breach of an obligation essential to the contract, and is limited to the damage
          typically foreseeable for a service of this kind. Mandatory statutory liability is
          unaffected.
        </p>
      </Clause>

      <Clause heading="Payment">
        <p>
          Docket is free today and nothing is for sale. If a paid plan appears, its price and terms
          will be stated before anyone is asked for anything, and the free register will stay free.
        </p>
      </Clause>

      <Clause heading="Ending it">
        <p>
          Delete your account from Settings whenever you like; it takes effect immediately and
          removes everything. We may suspend an account that is being used to attack the service or
          break the law, and will say why where we can.
        </p>
      </Clause>

      <Clause heading="Changes">
        <p>
          Material changes are announced by email before they take effect. Continuing to use Docket
          afterwards means accepting them; if you would rather not, delete the account and take your
          export with you.
        </p>
      </Clause>
    </LegalPage>
  );
}
