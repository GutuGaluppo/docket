import Link from "next/link";
import { redirect } from "next/navigation";

import { signOut } from "@/auth";
import { CabinetTabs } from "@/components/CabinetTabs";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LegalFooter } from "@/components/legal/LegalFooter";
import { getSession } from "@/server/auth/session";

/**
 * The real authorisation gate. Middleware only looks at a cookie; this is
 * where the session is validated against the database before anything renders.
 *
 * The shell it renders is a drawer: the label plate and the controls that are
 * not sections sit on the front, the sections are folder tabs along the top
 * edge, and the page is the folder standing open behind the one that is
 * forward. See `.cabinet` in `globals.css` for why it is drawn that way.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/sign-in");

  return (
    <div className="min-h-screen px-4 pt-8 pb-16 sm:px-5 sm:pt-10">
      <div className="mx-auto max-w-[1080px]">
        <div className="cabinet-head">
          <Link href="/docket" className="cabinet-plate">
            Docket
          </Link>
          <div className="flex items-center gap-4 font-mono text-[11px] tracking-[0.1em] text-muted uppercase">
            <ThemeToggle />
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/sign-in" });
              }}
            >
              <button type="submit" className="cursor-pointer font-mono tracking-[0.1em] uppercase">
                Sign out
              </button>
            </form>
          </div>
        </div>

        <div className="cabinet">
          <CabinetTabs />
          <div className="folder">{children}</div>
        </div>

        <LegalFooter
          compact
          contactName={session.user.name ?? ""}
          contactEmail={session.user.email ?? ""}
        />
      </div>
    </div>
  );
}
