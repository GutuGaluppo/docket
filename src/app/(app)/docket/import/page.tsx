import type { Metadata } from "next";
import Link from "next/link";

import { ImportForm } from "@/components/docket/ImportForm";

export const metadata: Metadata = { title: "Import" };

export default function ImportPage() {
  return (
    <>
      <header className="border-b-2 border-ink pb-4">
        <p className="eyebrow mb-1.5 text-stamp">Transfer of records</p>
        <h1 className="text-[clamp(28px,5vw,42px)] leading-none font-bold tracking-[-0.02em]">
          Import
        </h1>
        <p className="mt-2 max-w-[52ch] text-sm text-muted">
          Bring in the CSV or JSON you exported from the prototype, from a spreadsheet, or from
          Docket itself. Company and position are required; everything else is optional.
        </p>
      </header>

      <ImportForm />

      <section className="mt-8 max-w-[62ch] font-mono text-xs leading-relaxed text-muted">
        <p className="eyebrow mb-2 text-stamp">What we read</p>
        <ul className="list-none space-y-1">
          <li>company / empresa · position / posição — required</li>
          <li>site, url · city / cidade · country / país · notes / observações</li>
          <li>tags, stacks, stack — an array, or a list separated by · ; |</li>
          <li>createdAt / criadoEm / data da aplicação — ISO or dd/mm/yyyy HH:MM</li>
          <li>the prototype&rsquo;s single &ldquo;País/Cidade&rdquo; column is split for you</li>
          <li>no tags but a job description? the detector runs over it again</li>
        </ul>
        <p className="mt-4">
          Rows we cannot read are listed back to you with the line number. Nothing is silently
          dropped.
        </p>
        <p className="mt-4">
          <Link href="/docket" className="border-b border-stamp text-ink">
            Back to your docket
          </Link>
        </p>
      </section>
    </>
  );
}
