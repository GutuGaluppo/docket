import { Archivo, JetBrains_Mono } from "next/font/google";

export const archivo = Archivo({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-archivo",
});

/**
 * Data, protocol numbers and stamps. Replaces Courier Prime: the typewriter
 * face carried the archival joke, but its narrow figures and thin strokes made
 * small uppercase labels hard to read. JetBrains Mono keeps the monospace
 * signal with figures built for column alignment.
 */
export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "700"],
  display: "swap",
  variable: "--font-mono-face",
});
