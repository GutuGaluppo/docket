import type { Metadata, Viewport } from "next";

import { THEME_INIT_SCRIPT } from "@/components/ThemeToggle";
import { archivo, jetbrainsMono } from "@/lib/fonts";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: "Docket",
    template: "%s · Docket",
  },
  description:
    "Every application you send, on the record. Each entry gets a number and a stamp with the local date and time.",
  applicationName: "Docket",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#DBD9D1" },
    { media: "(prefers-color-scheme: dark)", color: "#191813" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      // The init script stamps data-theme here before React runs, so the
      // attribute legitimately differs from what the server sent.
      suppressHydrationWarning
      className={`${archivo.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      {/*
        Extensions edit <body> before React hydrates — Grammarly stamps
        data-gr-ext-installed on it, password managers do the same. The flag
        only covers this element's own attributes, one level deep, so a real
        mismatch inside a component still reports.
      */}
      <body suppressHydrationWarning className="min-h-screen bg-paper text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
