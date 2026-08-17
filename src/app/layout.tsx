import type { Metadata, Viewport } from "next";

import { archivo, courierPrime } from "@/lib/fonts";

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
  themeColor: "#DBD9D1",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${courierPrime.variable}`}>
      <body className="min-h-screen bg-paper text-ink antialiased">{children}</body>
    </html>
  );
}
