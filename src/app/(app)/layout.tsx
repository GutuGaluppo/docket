import { redirect } from "next/navigation";

import { signOut } from "@/auth";
import { AppShell } from "@/components/shell/AppShell";
import { LegalFooter } from "@/components/legal/LegalFooter";
import { CommandPalette } from "@/components/command/CommandPalette";
import { RedesignBanner } from "@/components/shared/RedesignBanner";
import { getSession } from "@/server/auth/session";

/**
 * The real authorisation gate. Middleware only looks at a cookie; this is where
 * the session is validated against the database before anything renders.
 *
 * Everything below the gate is handed to `AppShell`, which draws the sidebar and
 * the bar above the page. The sign-out form is built here rather than there:
 * it closes over a server action, and that has to be created on the server and
 * passed down as rendered output.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/sign-in");

  return (
    <>
      <CommandPalette />
      <AppShell
        email={session.user.email ?? ""}
        signOut={
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
        }
        footer={
          <LegalFooter
            compact
            contactName={session.user.name ?? ""}
            contactEmail={session.user.email ?? ""}
          />
        }
      >
        <RedesignBanner />
        {children}
      </AppShell>
    </>
  );
}
