"use client";

import { useEffect } from "react";

interface Shortcut {
  keys: string[];
  description: string;
}

interface ShortcutGroup {
  title: string;
  shortcuts: Shortcut[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "Global",
    shortcuts: [
      { keys: ["⌘", "K"], description: "Open command palette" },
      { keys: ["C"], description: "New entry (stamp)" },
      { keys: ["/"], description: "Focus search" },
      { keys: ["?"], description: "Show shortcuts" },
      { keys: ["⌘", ","], description: "Open settings" },
      { keys: ["⌘", "D"], description: "Toggle dark mode" },
    ],
  },
  {
    title: "Navigation",
    shortcuts: [
      { keys: ["G", "D"], description: "Go to Docket" },
      { keys: ["G", "B"], description: "Go to Board" },
      { keys: ["G", "C"], description: "Go to Calendar" },
      { keys: ["G", "V"], description: "Go to CV" },
      { keys: ["G", "A"], description: "Go to Archive" },
    ],
  },
  {
    title: "Table",
    shortcuts: [
      { keys: ["↑", "↓"], description: "Move selection" },
      { keys: ["Enter"], description: "Open entry details" },
      { keys: ["E"], description: "Edit entry" },
      { keys: ["R"], description: "Reject entry" },
      { keys: ["Delete"], description: "Delete entry" },
      { keys: ["Space"], description: "Toggle selection" },
    ],
  },
  {
    title: "Board",
    shortcuts: [
      { keys: ["Tab"], description: "Next column" },
      { keys: ["Shift", "Tab"], description: "Previous column" },
      { keys: ["←", "→"], description: "Move card" },
      { keys: ["Enter"], description: "Open card details" },
      { keys: ["E"], description: "Edit card" },
    ],
  },
];

interface KeyboardShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsModal({ open, onClose }: KeyboardShortcutsModalProps) {
  useEffect(() => {
    if (!open) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 animate-slide-up">
        <div className="mx-4 max-h-[80vh] overflow-hidden rounded-lg border border-rule bg-raised shadow-elevation-4">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-rule px-6 py-4">
            <h2 className="text-lg font-semibold text-ink">Keyboard Shortcuts</h2>
            <button
              className="rounded p-1 text-muted hover:bg-card hover:text-ink"
              onClick={onClose}
              aria-label="Close"
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

          {/* Content */}
          <div className="overflow-y-auto p-6" style={{ maxHeight: "calc(80vh - 140px)" }}>
            <div className="grid gap-8 md:grid-cols-2">
              {SHORTCUT_GROUPS.map((group) => (
                <div key={group.title}>
                  <h3 className="mb-4 font-mono text-xs uppercase tracking-wider text-muted">
                    {group.title}
                  </h3>
                  <div className="space-y-3">
                    {group.shortcuts.map((shortcut, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-sm text-ink">{shortcut.description}</span>
                        <div className="flex gap-1">
                          {shortcut.keys.map((key, keyIndex) => (
                            <kbd
                              key={keyIndex}
                              className="min-w-[2rem] rounded border border-rule bg-card px-2 py-1 text-center font-mono text-xs text-muted shadow-sm"
                            >
                              {key}
                            </kbd>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-rule bg-card px-6 py-3 text-center">
            <p className="text-xs text-faint">
              Press <kbd className="rounded border border-rule bg-raised px-1.5 py-0.5 font-mono text-[10px]">?</kbd> anytime to see this help
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
