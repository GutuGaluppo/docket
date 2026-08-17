import { redirect } from "next/navigation";

import { auth } from "@/auth";

/**
 * Placeholder root. The public landing page is phase 5; until then the root
 * just routes people to the register or to sign-in.
 */
export default async function HomePage() {
  const session = await auth();
  redirect(session?.user?.id ? "/docket" : "/sign-in");
}
