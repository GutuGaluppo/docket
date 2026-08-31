"use client";

import { useState, useEffect } from "react";

/**
 * Banner that appears at the top of pages to indicate the new UI is active.
 * Can be dismissed and won't show again.
 */
export function RedesignBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem("docket:redesignBannerDismissed");
    setShow(!dismissed);
  }, []);

  if (!show) return null;

  const handleDismiss = () => {
    localStorage.setItem("docket:redesignBannerDismissed", "true");
    setShow(false);
  };

  return (
    <div className="mb-6 animate-slide-up rounded-lg border-2 border-stamp bg-stamp-wash p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-lg">✨</span>
            <h3 className="font-semibold text-ink">New UI Active — 2026 Redesign</h3>
          </div>
          <p className="text-sm text-muted">
            You&apos;re viewing the modernized interface with improved keyboard navigation.{" "}
            <strong>Press ⌘K</strong> to open the command palette, or{" "}
            <strong>press ?</strong> for all shortcuts.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1 font-mono">
              <span className="h-1.5 w-1.5 rounded-full bg-stamp"></span>
              Keyboard-first
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1 font-mono">
              <span className="h-1.5 w-1.5 rounded-full bg-stamp"></span>
              Higher density
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1 font-mono">
              <span className="h-1.5 w-1.5 rounded-full bg-stamp"></span>
              Modern design
            </span>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="rounded p-1 text-muted hover:bg-stamp-edge hover:text-ink"
          aria-label="Dismiss"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
