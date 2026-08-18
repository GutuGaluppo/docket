import type { Metadata } from "next";
import Link from "next/link";

import { Clause, LegalPage } from "@/components/legal/Prose";
import {
  IMPRESSUM_READY,
  LAST_UPDATED,
  OPERATOR,
  SUBPROCESSORS,
  SUPERVISORY_AUTHORITY,
} from "@/lib/legal";

export const metadata: Metadata = {
  title: { absolute: "Privacy — Docket" },
  description:
    "What Docket stores, why, where it is kept, who else touches it, and how to take it back or delete it.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Privacy"
      title="What we hold, and why"
      intro="Written to be read. Docket keeps a register of the jobs you applied for; this page says exactly what that means in data terms."
      updated={LAST_UPDATED}
    >
      <Clause heading="Who is responsible">
        <p>
          {OPERATOR.name}, a private individual based in {OPERATOR.city}, {OPERATOR.country},
          operates Docket and decides how your data is processed. Contact:{" "}
          <a href={`mailto:${OPERATOR.email}`} className="border-b border-stamp text-ink">
            {OPERATOR.email}
          </a>
          .{" "}
          {IMPRESSUM_READY && (
            <>
              The full postal address is in the{" "}
              <Link href="/impressum" className="border-b border-stamp text-ink">
                Impressum
              </Link>
              .
            </>
          )}
        </p>
      </Clause>

      <Clause heading="What is stored">
        <p>
          <b className="text-ink">Your account.</b> Name, email address and profile picture, as
          supplied by Google or GitHub when you sign in. We never receive your password.
        </p>
        <p>
          <b className="text-ink">Your register.</b> For each application: company, website,
          position, city, country, the stage it is in, the technologies detected, the timezone you
          stamped it in, and the dates. Two fields are free text and hold whatever you type — your
          notes and the job advertisement you pasted. Interviews you schedule store a title, time,
          duration, place and notes.
        </p>
        <p>
          <b className="text-ink">Technical.</b> One cookie, which keeps you signed in. There is no
          advertising, tracking or profiling cookie, so there is no consent banner to click.
        </p>
        <p>
          <b className="text-ink">Contact.</b> When you use the contact form, we receive the email
          address, subject and message you provide so we can read and reply to your request.
        </p>
        <p>
          <b className="text-ink">Counting.</b> Seven things are counted so we can tell whether the
          site works: the landing page being opened, the detector on it being used, the pricing
          section being reached, the sign-in screen being opened, an account being created, a first
          entry being stamped, and a paid feature being reached on the free plan. Nothing is stored
          on your device to do it — no cookie, no local storage — so an anonymous visit leaves no
          identifier behind and cannot be joined to a later one. Your IP is dropped before the
          measurement is sent. What you paste into the detector on the landing page is never
          transmitted: only the fact that the box was used. Two of the counts — an account being
          created and a first entry being stamped — are tied to your account, because by then you
          have one.
        </p>
      </Clause>

      <Clause heading="Why we are allowed to">
        <p>
          Running your account and keeping the register is the performance of our agreement with you
          — art. 6(1)(b) GDPR. Keeping the service secure and preventing abuse rests on our
          legitimate interest, art. 6(1)(f). Follow-up emails are sent only after you switch them
          on, and switching them off stops them. Contact messages are processed to answer the
          request you chose to send, under our legitimate interest in providing support.
        </p>
      </Clause>

      <Clause heading="Sensitive information">
        <p>
          The notes and job-description fields accept anything. Art. 9 GDPR treats data about
          health, beliefs, union membership and similar as a special category with stricter rules.
          Docket is not built to hold that, and the fields say so where you type. Please keep it
          out.
        </p>
      </Clause>

      <Clause heading="Where it lives, and who else touches it">
        <p>
          Everything stays inside the European Union. These are the only companies that process your
          data on our behalf, each under a data processing agreement:
        </p>
        <div className="mt-1 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {["Who", "What for", "Where"].map((h) => (
                  <th
                    key={h}
                    className="border-b-[1.5px] border-ink py-2 pr-4 text-left font-mono text-[10px] tracking-[0.14em] text-muted uppercase"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SUBPROCESSORS.map((s) => (
                <tr key={s.name}>
                  <td className="border-b border-rule py-2.5 pr-4 whitespace-nowrap text-ink">
                    {s.name}
                  </td>
                  <td className="border-b border-rule py-2.5 pr-4">{s.role}</td>
                  <td className="border-b border-rule py-2.5 whitespace-nowrap">{s.where}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1">
          One more thing your browser does: to show a company logo it asks{" "}
          <code className="font-mono text-xs">logo.clearbit.com</code>, falling back to
          Google&rsquo;s favicon service. Those requests carry the company&rsquo;s domain name and
          your IP address, never your identity or your notes.
        </p>
      </Clause>

      <Clause heading="How long">
        <p>
          For as long as you keep the account. Delete it and every entry, tag, stage event,
          interview and reminder goes with it, immediately and without a recovery window. Backups
          held by our database provider roll off on their own schedule.
        </p>
        <p>
          A message sent through the contact form is the exception: it arrives as an email and stays
          in the inbox that answers it, so deleting your account does not delete it. Ask and it is
          removed.
        </p>
      </Clause>

      <Clause heading="What you can do">
        <p>
          Under the GDPR you may access, correct, delete and take your data, restrict or object to
          processing, and withdraw consent. Two of those need no request at all: Settings exports
          everything as JSON or CSV, and deletes the account, at any time and on every plan.
        </p>
        <p>
          For anything else, write to{" "}
          <a href={`mailto:${OPERATOR.email}`} className="border-b border-stamp text-ink">
            {OPERATOR.email}
          </a>
          . You can also complain to a supervisory authority — ours is the{" "}
          <a
            href={SUPERVISORY_AUTHORITY.url}
            target="_blank"
            rel="noopener noreferrer"
            className="border-b border-stamp text-ink"
          >
            {SUPERVISORY_AUTHORITY.name}
          </a>
          .
        </p>
        <p>
          If you are in Brazil, the LGPD gives you equivalent rights and the same address answers
          them.
        </p>
      </Clause>

      <Clause heading="What we will not do">
        <p>
          Sell your data. Share it with recruiters or employers. Use it to train anything. Show you
          advertising. There is no other side to this product: the register has one reader, and it
          is you.
        </p>
      </Clause>

      <Clause heading="Changes">
        <p>
          If this page changes in a way that affects you, the date at the top moves and you will be
          told by email before it takes effect.
        </p>
      </Clause>
    </LegalPage>
  );
}
