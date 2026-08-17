import Link from "next/link";
import { redirect } from "next/navigation";

import { auth, signOut } from "@/auth";
import { ThemeToggle } from "@/components/ThemeToggle";

/**
 * The real authorisation gate. Middleware only looks at a cookie; this is
 * where the session is validated against the database before anything renders.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  return (
    <div className="min-h-screen px-5 pt-10 pb-20">
      <div className="mx-auto max-w-[1080px]">
        <nav className="mb-6 flex flex-wrap items-center justify-between gap-3 font-mono text-[11px] tracking-[0.1em] text-muted uppercase">
          <div className="flex items-center gap-5">
            <Link href="/docket" className="text-ink">
              Docket
            </Link>
            <Link href="/board">Board</Link>
            <Link href="/calendar">Calendar</Link>
            <Link href="/docket/import">Import</Link>
            <Link href="/settings">Settings</Link>
          </div>
          <div className="flex items-center gap-4">
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
        </nav>
        {children}
      </div>
    </div>
  );
}
