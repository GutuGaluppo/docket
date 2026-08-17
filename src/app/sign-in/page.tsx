import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth, configuredProviders, signIn } from "@/auth";
import { safeInternalPath } from "@/lib/routes";

export const metadata: Metadata = { title: "Sign in" };

const PROVIDER_LABELS: Record<string, string> = {
  google: "Continue with Google",
  github: "Continue with GitHub",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();
  const { callbackUrl } = await searchParams;
  const target = safeInternalPath(callbackUrl);

  if (session?.user) redirect(target);

  return (
    <main className="mx-auto flex min-h-screen max-w-[420px] flex-col justify-center px-5 py-16">
      <p className="eyebrow mb-2 text-stamp">Registry access</p>
      <h1 className="text-4xl font-bold tracking-[-0.02em]">Docket</h1>
      <p className="mt-3 max-w-[40ch] text-sm text-muted">
        Sign in to open your docket. We use your account only to identify the record as yours.
      </p>

      <div className="mt-8 flex flex-col gap-3">
        {configuredProviders.length === 0 ? (
          <p className="border border-dashed border-rule bg-card p-4 font-mono text-xs text-muted">
            No sign-in provider is configured. Set AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET or
            AUTH_GITHUB_ID / AUTH_GITHUB_SECRET in .env.local.
          </p>
        ) : (
          configuredProviders.map((provider) => (
            <form
              key={provider.id}
              action={async () => {
                "use server";
                await signIn(provider.id, { redirectTo: target });
              }}
            >
              <button type="submit" className="btn w-full">
                {PROVIDER_LABELS[provider.id] ?? `Continue with ${provider.name}`}
              </button>
            </form>
          ))
        )}
      </div>

      <p className="mt-8 border-t border-rule pt-4 font-mono text-xs leading-relaxed text-muted">
        Your entries are yours. Export them as CSV or JSON at any time, and delete the account in
        one click.
      </p>
    </main>
  );
}
