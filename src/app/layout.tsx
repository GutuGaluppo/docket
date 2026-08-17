import type { Metadata, Viewport } from "next";

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
    <html lang="en" className={`${archivo.variable} ${jetbrainsMono.variable}`}>
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
