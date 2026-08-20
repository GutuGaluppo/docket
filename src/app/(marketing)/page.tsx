import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";

import { HeroDetector } from "@/components/marketing/HeroDetector";
import { Reveal } from "@/components/marketing/Reveal";
import { StepArt, type Step } from "@/components/marketing/StepArt";
import { Track } from "@/components/analytics/Track";
import { EVENTS } from "@/lib/analytics/events";
import { priceFor } from "@/lib/pricing";

const DESCRIPTION =
  "A numbered register of the jobs you applied for. Drop the job link and we track the rest: every application gets its own number, date, time and the tech stack, tagged automatically. Export or delete everything whenever you want.";

export const metadata: Metadata = {
  // `absolute` opts out of the root layout's "%s · Docket" template, which
  // would otherwise append the brand to a title that already opens with it.
  title: { absolute: "Docket — every application you send, on the record" },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
};

/** One label, three places. Changing it here changes it everywhere. */
const CTA = "Start your docket";

const STEPS: ReadonlyArray<{ art: Step; title: string; body: string }> = [
  {
    art: "link",
    title: "Drop the job link",
    body: "Straight from the tab you already have open. We read the ad and fill the fields — company, role, city — so there is nothing to type first.",
  },
  {
    art: "tags",
    title: "Check the tags",
    body: "About a hundred technologies are recognised by name and by nickname. Remove what does not belong, add what was missed.",
  },
  {
    art: "stamp",
    title: "Stamp it",
    body: "The entry takes the next number in your register and a stamp with the local date and time. That part is never editable.",
  },
];

const SHOTS = [
  {
    src: "/shots/register.png",
    dark: "/shots/register-dark.png",
    height: 900,
    caption: "The register. Search, sort, export.",
    alt: "The register: numbered entries with company, position, stack tags and a violet stamp carrying the date and time.",
  },
  {
    src: "/shots/board.png",
    dark: "/shots/board-dark.png",
    height: 460,
    caption: "The board. Columns you name yourself.",
    alt: "The board: columns from Application sent to Offer received, with cards carrying protocol numbers and stack tags.",
  },
];

const FAQ = [
  {
    q: "What happens to my entries if I stop paying?",
    a: "Nothing is deleted. Pro features go read-only with a mark on them, and everything you recorded stays readable and exportable. Losing someone's data because a card expired is not a retention strategy.",
  },
  {
    q: "Can I export everything?",
    a: "Yes, at any moment, without asking. CSV for spreadsheets and complete JSON for everything else — entries, tags, stage history, timestamps. Both are one click in Settings, on the free plan too.",
  },
  {
    q: "Does it work for ads in other languages?",
    a: "The detector matches technology names, and those are written the same way in a German, Portuguese or English ad. The surrounding prose does not matter. The interface itself is English for now.",
  },
  {
    q: "Does the report count as proof of job seeking for the Jobcenter?",
    a: "The export lists every application with company, position, city and the exact date and time it was sent, in order and numbered. Whether your case worker accepts that format is between you and them — we make the record, we cannot promise how it is received.",
  },
  {
    q: "How do I cancel?",
    a: "From the billing portal, in one click, and Pro stays active until the end of the period you already paid for. You can also delete the whole account from Settings, which removes every entry immediately and for good.",
  },
];

export default async function LandingPage() {
  const headerList = await headers();
  const price = priceFor(headerList.get("x-vercel-ip-country"));

  /*
    The landing does not read the session.
    
    It used to, only to relabel the call to action for someone already signed
    in — which cost a database round trip on the one page that has to be fast
    for people who have no account at all. The sign-in screen already redirects
    an authenticated visitor to their docket, so the plain link reaches the same
    place with one hop that nobody sees, and the page stops depending on who is
    asking.
  */

  /**
   * SoftwareApplication, with no aggregateRating. The brief is explicit: a
   * rating goes in only when real ratings exist. Inventing one to win a
   * rich-result star is the kind of thing that gets a site delisted, and it
   * would be a lie on the first page a stranger sees.
   */
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Docket",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: DESCRIPTION,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "EUR",
      description: "Unlimited applications, stack detection, board and calendar.",
    },
  };

  return (
    <>
      <Track event={EVENTS.landingView} />
      <script
        type="application/ld+json"
        // The payload is a literal defined above; nothing here comes from input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── hero ─────────────────────────────────────────────────────────── */}
      <section className="grid items-start gap-10 border-b-2 border-ink pb-14 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
        <div className="flex flex-col gap-6">
          <p className="eyebrow text-stamp">Personal register</p>
          <h1 className="text-[clamp(var(--text-3xl),6.5vw,var(--text-6xl))] leading-[0.98] font-bold tracking-[-0.03em] text-balance">
            Every application you send, on the record.
          </h1>
          <p className="max-w-[48ch] text-md text-muted">
            <b className="font-semibold text-ink">Drop the job link. We track the rest.</b> Every
            application gets its own number, date, time — and the tech stack, tagged automatically.
            No spreadsheets, no manual work. Just a simple list of everywhere you&rsquo;ve applied.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <Link href="/sign-in" className="btn no-underline">
              {CTA}
            </Link>
            <span className="font-mono text-xs text-muted">
              Free forever for the register itself.
            </span>
          </div>

          {/*
            An example entry, exactly as the app renders it. The company is
            invented, like the ones in the screenshots below: this page is
            public, and a real third-party name here would imply an association
            that does not exist.
          */}
          <div className="mt-2 flex items-start gap-4 rounded-[3px] border border-rule bg-card p-4 shadow-paper">
            <span className="font-mono text-xs text-muted">001</span>
            <div className="flex-1">
              <p className="font-semibold">Meridian Labs</p>
              <p className="text-sm text-muted">Senior Frontend Developer</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {["React", "TypeScript", "Next.js"].map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <span className="stamp">
              <span className="stamp-date">16/08/2026</span>
              <span className="stamp-time">23:41</span>
            </span>
          </div>
        </div>

        <div className="rounded-[3px] border border-rule bg-card p-5 shadow-paper">
          <HeroDetector />
        </div>
      </section>

      {/* ── how it works ─────────────────────────────────────────────────── */}
      <Reveal>
        <section className="border-b border-rule py-14">
          <p className="eyebrow mb-2 text-stamp">How it works</p>
          <h2 className="mb-3 text-[clamp(var(--text-2xl),4vw,var(--text-4xl))] leading-tight font-bold tracking-[-0.02em]">
            Three steps, in this order
          </h2>
          <p className="mb-10 max-w-[54ch] text-md text-muted">
            From the tab you already have open to a numbered line in your register. Nothing in
            between gets typed twice.
          </p>

          {/* Each step is a card with its own number tacked to the top edge, so
              the sequence is readable at a glance instead of being three
              paragraphs that happen to sit side by side. */}
          <ol className="grid list-none gap-5 p-0 sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className="relative flex flex-col gap-3 rounded-[3px] border border-rule bg-card p-6 pt-7 shadow-paper"
              >
                <span
                  aria-hidden="true"
                  className="absolute -top-3 left-6 rounded-[2px] border border-stamp bg-card px-2 py-0.5 font-mono text-[11px] font-bold tracking-[0.12em] text-stamp"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <StepArt step={step.art} />
                <h3 className="text-lg font-bold tracking-[-0.01em]">{step.title}</h3>
                <p className="text-sm text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>
      </Reveal>

      {/* ── what you see ─────────────────────────────────────────────────── */}
      <Reveal>
        <section className="border-b border-rule py-14">
          <p className="eyebrow mb-2 text-stamp">What you get to see</p>
          <h2 className="mb-3 text-2xl font-bold tracking-[-0.015em]">
            The register, and the shape of the search
          </h2>
          <p className="mb-8 max-w-[58ch] text-sm text-muted">
            Direct captures of the app. Nothing staged, nothing angled — the entries below are
            illustrative, the interface is exactly what you get.
          </p>

          <div className="grid gap-8 lg:grid-cols-2">
            {SHOTS.map((shot) => (
              <figure key={shot.src} className="m-0 flex flex-col gap-2">
                {/*
                  A light screenshot on a dark page glows. <picture> swaps it
                  natively — no JavaScript, no layout shift, and the browser only
                  downloads the one it needs.
                */}
                <picture>
                  <source srcSet={shot.dark} media="(prefers-color-scheme: dark)" />
                  <img
                    src={shot.src}
                    alt={shot.alt}
                    width={1180}
                    height={shot.height}
                    loading="lazy"
                    decoding="async"
                    className="w-full rounded-[2px] border border-rule"
                  />
                </picture>
                <figcaption className="font-mono text-xs text-muted">{shot.caption}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      </Reveal>

      {/* ── privacy ──────────────────────────────────────────────────────── */}
      <Reveal>
        <section className="border-b border-rule py-14">
          <p className="eyebrow mb-2 text-stamp">Your data</p>
          <h2 className="mb-3 text-2xl font-bold tracking-[-0.015em]">The record is yours</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Export any time", "CSV and complete JSON, on every plan, without asking anyone."],
              [
                "Delete in one click",
                "Account deletion removes every entry, tag and event immediately.",
              ],
              ["Never sold", "No data brokers, no ad networks, no training sets."],
              [
                "Never sent to recruiters",
                "Nobody sees your register but you. There is no other side to this product.",
              ],
            ].map(([title, body]) => (
              <div key={title} className="flex flex-col gap-1.5 border-t border-rule pt-3">
                <h3 className="text-sm font-semibold">{title}</h3>
                <p className="text-sm text-muted">{body}</p>
              </div>
            ))}
          </div>
        </section>
      </Reveal>

      {/* ── pricing ──────────────────────────────────────────────────────── */}
      <Reveal>
        <section className="border-b border-rule py-14">
          <Track event={EVENTS.pricingView} on="visible" />
          <p className="eyebrow mb-2 text-stamp">Pricing</p>
          <h2 className="mb-8 text-2xl font-bold tracking-[-0.015em]">Two plans</h2>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="flex flex-col gap-4 rounded-[3px] border border-rule bg-card p-6 shadow-paper">
              <div>
                <p className="eyebrow text-muted">Free</p>
                <p className="mt-2 font-mono text-3xl font-bold">{price.currency}0</p>
              </div>
              <ul className="flex list-none flex-col gap-2 p-0 text-sm text-muted">
                <li>Unlimited applications — the register is never capped</li>
                <li>The full stack detector</li>
                <li>One board, three stages</li>
                <li>CSV and JSON export</li>
                <li>Interview calendar with subscribable feed</li>
              </ul>
            </div>

            <div className="flex flex-col gap-4 rounded-[3px] border border-stamp bg-card p-6 shadow-paper">
              <div>
                <p className="eyebrow text-stamp">Pro</p>
                <p className="mt-2 font-mono text-3xl font-bold">
                  {price.currency}
                  {price.monthly}
                  <span className="text-base font-normal text-muted"> / month</span>
                </p>
                <p className="font-mono text-xs text-muted">
                  or {price.currency}
                  {price.yearly} a year
                </p>
              </div>
              <ul className="flex list-none flex-col gap-2 p-0 text-sm text-muted">
                <li>Unlimited, custom funnel stages</li>
                <li>Follow-up reminders by email</li>
                <li>Response rate by stack, country and source</li>
                <li>Attachments — the CV version you actually sent</li>
                <li>Multiple boards, and a PDF report</li>
              </ul>
              <p className="mt-auto font-mono text-xs text-stamp">
                7 days of Pro, no card asked for.
              </p>
            </div>
          </div>

          {price.adjustedFor && (
            <p className="mt-5 font-mono text-xs text-muted">
              Price adjusted for {price.adjustedFor}. Same product, same features.
            </p>
          )}
          <p className="mt-2 max-w-[62ch] font-mono text-xs text-muted">
            Pro is not on sale yet — checkout is still being built. Everything listed under Free
            works today.
          </p>

          <Link href="/sign-in" className="btn mt-8 inline-block no-underline">
            {CTA}
          </Link>
        </section>
      </Reveal>

      {/* ── faq ──────────────────────────────────────────────────────────── */}
      <Reveal>
        <section className="py-14">
          <p className="eyebrow mb-2 text-stamp">Questions</p>
          <h2 className="mb-8 text-2xl font-bold tracking-[-0.015em]">
            The ones worth answering first
          </h2>

          <div className="flex flex-col">
            {FAQ.map((item) => (
              <details key={item.q} className="group border-b border-rule py-4">
                <summary className="cursor-pointer list-none text-md font-semibold marker:content-none">
                  <span className="mr-2 font-mono text-stamp group-open:hidden">+</span>
                  <span className="mr-2 hidden font-mono text-stamp group-open:inline">−</span>
                  {item.q}
                </summary>
                <p className="mt-3 max-w-[64ch] pl-6 text-sm text-muted">{item.a}</p>
              </details>
            ))}
          </div>

          <Link href="/sign-in" className="btn mt-10 inline-block no-underline">
            {CTA}
          </Link>
        </section>
      </Reveal>
    </>
  );
}
