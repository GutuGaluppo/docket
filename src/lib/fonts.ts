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
/*
  Both faces stay preloaded, and the reason is a measurement rather than a
  preference.

  Each subset carries a `unicode-range`, so a browser left alone fetches a file
  only when the page contains a character it covers. A preload link overrides
  that and fetches unconditionally: the landing pulls all four files, 109 kB, on
  copy that has no latin-ext character in it — two of them are downloaded to be
  used by nothing.

  Taking the mono face off the preload list is the obvious repair, and it was
  tried twice. Median of five Lighthouse runs against a production build, same
  machine, same commit otherwise:

    preloaded (today)     LCP 2258 ms   FCP  907 ms   performance 99
    preload: false        LCP 3465 ms   FCP 1208 ms   performance 91

  It is consistently worse, and the FCP regression says why it is not a font
  race: something about how next/font delivers the stylesheet for a non-preloaded
  face lands on the critical path. So the waste stays, deliberately, because the
  alternative measured worse.

  The 32 kB of unused Archivo latin-ext is the part still worth removing, and the
  only way there is a latin-only instance scoped to the marketing routes — the
  city list needs those glyphs for Łódź, Timișoara and İstanbul, so the subset
  cannot simply be dropped for everyone.
*/
export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "700"],
  display: "swap",
  variable: "--font-mono-face",
});
