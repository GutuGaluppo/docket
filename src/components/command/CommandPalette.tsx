"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { SectionIcon, type IconName } from "@/components/shell/SectionIcon";

interface Command {
  id: string;
  label: string;
  icon?: IconName;
  shortcut?: string;
  action: () => void;
  group: string;
  keywords?: string[];
}

interface CommandGroup {
  heading: string;
  commands: Command[];
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showHint, setShowHint] = useState(true);
  const router = useRouter();

  // Hide hint after first use
  useEffect(() => {
    if (open) {
      setShowHint(false);
      localStorage.setItem("docket:commandPaletteUsed", "true");
    }
  }, [open]);

  // Check if user has used it before
  useEffect(() => {
    const used = localStorage.getItem("docket:commandPaletteUsed");
    setShowHint(!used);
  }, []);

  // Define all available commands
  const allCommands: Command[] = useMemo(
    () => [
      // Actions
      {
        id: "stamp-new",
        label: "Stamp new entry",
        icon: "docket",
        shortcut: "C",
        action: () => router.push("/docket"),
        group: "Actions",
        keywords: ["new", "create", "add", "application"],
      },
      {
        id: "import",
        label: "Import applications",
        icon: "docket",
        action: () => router.push("/docket/import"),
        group: "Actions",
        keywords: ["upload", "csv", "json"],
      },
      {
        id: "export",
        label: "Export docket",
        action: () => router.push("/docket/export"),
        group: "Actions",
        keywords: ["download", "pdf", "excel", "csv"],
      },

      // Navigation
      {
        id: "nav-board",
        label: "Go to Board",
        icon: "board",
        action: () => router.push("/board"),
        group: "Navigation",
        keywords: ["kanban", "columns"],
      },
      {
        id: "nav-docket",
        label: "Go to Docket",
        icon: "docket",
        action: () => router.push("/docket"),
        group: "Navigation",
        keywords: ["table", "list", "register"],
      },
      {
        id: "nav-calendar",
        label: "Go to Calendar",
        icon: "calendar",
        action: () => router.push("/calendar"),
        group: "Navigation",
        keywords: ["interviews", "events"],
      },
      {
        id: "nav-cv",
        label: "Go to CV Tailoring",
        icon: "cv",
        action: () => router.push("/cv"),
        group: "Navigation",
        keywords: ["resume", "match", "tailor"],
      },
      {
        id: "nav-archive",
        label: "Go to Archive",
        icon: "archive",
        action: () => router.push("/archive"),
        group: "Navigation",
        keywords: ["rejected", "filed"],
      },
      {
        id: "nav-analytics",
        label: "Go to Analytics",
        icon: "analytics",
        action: () => router.push("/analytics"),
        group: "Navigation",
        keywords: ["stats", "metrics", "insights"],
      },

      // Settings
      {
        id: "toggle-theme",
        label: "Toggle theme",
        action: () => {
          const root = document.documentElement;
          const current = root.getAttribute("data-theme");
          root.setAttribute("data-theme", current === "dark" ? "light" : "dark");
        },
        group: "Settings",
        keywords: ["dark", "light", "mode"],
      },
      {
        id: "shortcuts",
        label: "Keyboard shortcuts",
        shortcut: "?",
        action: () => {
          // TODO: Open shortcuts modal
          alert("Shortcuts help coming soon!");
        },
        group: "Settings",
      },
      {
        id: "settings",
        label: "Settings",
        icon: "settings",
        action: () => router.push("/settings"),
        group: "Settings",
      },
    ],
    [router]
  );

  // Filter commands based on search
  const filteredCommands = useMemo(() => {
    if (!search) return allCommands;

    const query = search.toLowerCase();
    return allCommands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(query) ||
        cmd.keywords?.some((kw) => kw.toLowerCase().includes(query))
    );
  }, [search, allCommands]);

  // Group filtered commands
  const groupedCommands: CommandGroup[] = useMemo(() => {
    const groups = new Map<string, Command[]>();

    filteredCommands.forEach((cmd) => {
      const existing = groups.get(cmd.group) || [];
      groups.set(cmd.group, [...existing, cmd]);
    });

    return Array.from(groups.entries()).map(([heading, commands]) => ({
      heading,
      commands,
    }));
  }, [filteredCommands]);

  // Flatten for keyboard navigation
  const flatCommands = useMemo(
    () => filteredCommands,
    [filteredCommands]
  );

  // Execute selected command
  const executeCommand = useCallback(
    (command: Command) => {
      command.action();
      setOpen(false);
      setSearch("");
      setSelectedIndex(0);
    },
    []
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K to open
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
        return;
      }

      // Escape to close
      if (e.key === "Escape" && open) {
        setOpen(false);
        setSearch("");
        setSelectedIndex(0);
        return;
      }

      // Don't handle other shortcuts when palette is closed
      if (!open) return;

      // Arrow navigation
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < flatCommands.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
      }

      // Enter to execute
      else if (e.key === "Enter" && flatCommands[selectedIndex]) {
        e.preventDefault();
        executeCommand(flatCommands[selectedIndex]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, flatCommands, selectedIndex, executeCommand]);

  // Reset selection when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  if (!open) {
    return (
      <>
        {/* Floating hint badge - shows until first use */}
        {showHint && (
          <button
            onClick={() => setOpen(true)}
            className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-stamp px-4 py-3 text-sm font-medium text-on-stamp shadow-elevation-3 transition-all hover:shadow-elevation-4 hover:scale-105 animate-pulse-highlight"
            style={{ animationIterationCount: 3 }}
          >
            <span>Press</span>
            <kbd className="rounded bg-on-stamp/20 px-2 py-1 font-mono text-xs">
              ⌘K
            </kbd>
            <span>to search</span>
          </button>
        )}
      </>
    );
  }

  let commandIndex = 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm animate-fade-in"
        onClick={() => setOpen(false)}
      />

      {/* Palette */}
      <div className="fixed left-1/2 top-[20%] z-50 w-full max-w-2xl -translate-x-1/2 animate-slide-up">
        <div className="mx-4 overflow-hidden rounded-lg border border-rule bg-raised shadow-elevation-4">
          {/* Search input */}
          <div className="border-b border-rule">
            <input
              type="text"
              className="w-full bg-transparent px-4 py-4 text-base outline-none placeholder:text-faint"
              placeholder="Search commands..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>

          {/* Command groups */}
          <div className="max-h-[400px] overflow-y-auto">
            {groupedCommands.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted">
                No commands found
              </div>
            ) : (
              groupedCommands.map((group) => (
                <div key={group.heading}>
                  <div className="px-4 pt-3 pb-2">
                    <div className="text-xs uppercase tracking-wider text-faint">
                      {group.heading}
                    </div>
                  </div>
                  <div className="pb-2">
                    {group.commands.map((command) => {
                      const isSelected = commandIndex === selectedIndex;
                      const currentIndex = commandIndex++;

                      return (
                        <button
                          key={command.id}
                          className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                            isSelected
                              ? "bg-stamp-wash text-ink"
                              : "text-muted hover:bg-card hover:text-ink"
                          }`}
                          onClick={() => executeCommand(command)}
                          onMouseEnter={() => setSelectedIndex(currentIndex)}
                        >
                          {command.icon && (
                            <SectionIcon name={command.icon} className="h-4 w-4" />
                          )}
                          <span className="flex-1 text-sm">{command.label}</span>
                          {command.shortcut && (
                            <kbd className="rounded border border-rule bg-card px-2 py-0.5 font-mono text-xs text-faint">
                              {command.shortcut}
                            </kbd>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer hint */}
          <div className="border-t border-rule bg-card px-4 py-2 text-xs text-faint">
            <span className="mr-4">↑↓ Navigate</span>
            <span className="mr-4">↵ Select</span>
            <span>Esc Close</span>
          </div>
        </div>
      </div>
    </>
  );
}
