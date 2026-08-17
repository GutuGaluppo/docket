"use client";

import { useEffect, useState } from "react";

export type ThemeChoice = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "docket-theme";

/**
 * Runs before first paint, injected as a blocking inline script in the root
 * layout. Without it the page paints the OS theme and then snaps to the stored
 * one — the flash that makes a theme toggle feel broken.
 *
 * Kept as a string on purpose: it has to execute before React exists.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t}}catch(e){}})();`;

const OPTIONS: Array<{ value: ThemeChoice; label: string }> = [
  { value: "system", label: "Auto" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

function apply(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === "system") {
    delete root.dataset.theme;
    localStorage.removeItem(THEME_STORAGE_KEY);
  } else {
    root.dataset.theme = choice;
    localStorage.setItem(THEME_STORAGE_KEY, choice);
  }
}

/**
 * Three states, not two. Once someone has picked light or dark there has to be
 * a way back to following the OS, and a two-way switch quietly removes it.
 *
 * The selected state is read after mount rather than during render: the value
 * lives in localStorage, the server cannot know it, and pretending otherwise is
 * exactly how a hydration mismatch gets written.
 */
export function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    setChoice(stored === "light" || stored === "dark" ? stored : "system");
  }, []);

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className="inline-flex items-center rounded-[2px] border border-rule"
    >
      {OPTIONS.map((option) => {
        const active = choice === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            suppressHydrationWarning
            onClick={() => {
              apply(option.value);
              setChoice(option.value);
            }}
            className={`cursor-pointer px-2 py-1 font-mono text-[10px] tracking-[0.1em] uppercase transition-colors ${
              active ? "bg-stamp text-on-stamp" : "text-muted hover:text-stamp"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
