import type { Metadata } from "next";

import { SectionHeader } from "@/components/SectionHeader";
import { StampForm } from "@/components/docket/StampForm";

export const metadata: Metadata = { title: "New entry" };

/**
 * Stamping, on a page of its own.
 *
 * The form used to sit on top of the register, which meant the two things a
 * person comes here to do — add one application and read the fifty already
 * recorded — were competing for the same screen, and the form won by being at
 * the top. Separated, each one gets the width it needs, and the form gets to
 * end where it should: on the entry it just created.
 */
export default function NewEntryPage() {
  return (
    <>
      <SectionHeader section="new" />
      <StampForm />
    </>
  );
}
