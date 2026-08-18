import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";

import { EVENTS } from "@/lib/analytics/events";
import { captureForUser } from "@/server/analytics/capture";
import { db } from "@/server/db";
import { accounts, sessions, users, verificationTokens } from "@/server/db/schema";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

/** Providers register only when configured, so the app boots on a bare checkout. */
function providers(): NextAuthConfig["providers"] {
  const list: NextAuthConfig["providers"] = [];
  if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
    list.push(Google({ allowDangerousEmailAccountLinking: true }));
  }
  if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
    list.push(GitHub({ allowDangerousEmailAccountLinking: true }));
  }
  return list;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "database" },
  pages: { signIn: "/sign-in" },
  providers: providers(),
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
  events: {
    /**
     * Fires once per account, the moment the adapter writes the row — which is
     * the only unambiguous definition of "signed up". A sign-in event would
     * count every returning visit instead.
     */
    async createUser({ user }) {
      if (user.id) await captureForUser(user.id, EVENTS.signupCompleted);
    },
  },
});

export const configuredProviders = providers().map((p) => {
  const provider = typeof p === "function" ? p() : p;
  return { id: provider.id, name: provider.name };
});
