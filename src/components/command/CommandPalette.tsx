"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { SectionIcon, type IconName } from "@/components/shell/SectionIcon";
import { COMMAND_PALETTE_EVENT } from "./palette-channel";

/**
 * Everything the product can do, one keystroke away.
 *
 * It is a `<dialog>` rather than a pair of fixed-position divs, and that is the
 * fix for the bug that made it look broken: the old panel painted itself onto
 * a `bg-raised` class the theme never defined, so the words floated over
 * whatever page happened to be underneath. The top layer and `::backdrop` are
 * the browser's own answer to both halves of that — an opaque panel above
 * everything, and a scrim that cannot be escaped by a stacking context.
 */
type Command = {
  id: string;
  label: string;
  icon?: IconName;
  shortcut?: string;
  group: string;
  keywords?: readonly string[];
  action: () => void;
};

export function CommandPalette() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(0);
  const router = useRouter();

  const commands: readonly Command[] = useMemo(
    () => [
      {
        id: "stamp-new",
        label: "Stamp a new entry",
        icon: "plus",
        group: "Actions",
        keywords: ["new", "create", "add", "application"],
        action: () => router.push("/docket/new"),
      },
      {
        id: "import",
        label: "Import applications",
        icon: "import",
        group: "Actions",
        keywords: ["upload", "csv", "json"],
        action: () => router.push("/docket/import"),
      },
      {
        id: "nav-docket",
        label: "Go to Docket",
        icon: "docket",
        group: "Navigation",
        keywords: ["home", "overview", "start"],
        action: () => router.push("/docket"),
      },
      {
        id: "nav-applications",
        label: "Go to Applications",
        icon: "applications",
        group: "Navigation",
        keywords: ["table", "list", "register", "companies"],
        action: () => router.push("/applications"),
      },
      {
        id: "nav-board",
        label: "Go to Board",
        icon: "board",
        group: "Navigation",
        keywords: ["kanban", "columns", "stages"],
        action: () => router.push("/board"),
      },
      {
        id: "nav-calendar",
        label: "Go to Calendar",
        icon: "calendar",
        group: "Navigation",
        keywords: ["interviews", "events"],
        action: () => router.push("/calendar"),
      },
      {
        id: "nav-cv",
        label: "Go to CV",
        icon: "cv",
        group: "Navigation",
        keywords: ["resume", "match", "tailor"],
        action: () => router.push("/cv"),
      },
      {
        id: "nav-archive",
        label: "Go to Archive",
        icon: "archive",
        group: "Navigation",
        keywords: ["rejected", "filed"],
        action: () => router.push("/archive"),
      },
      {
        id: "nav-analytics",
        label: "Go to Analytics",
        icon: "analytics",
        group: "Navigation",
        keywords: ["stats", "metrics", "map", "insights"],
        action: () => router.push("/analytics"),
      },
      {
        id: "toggle-theme",
        label: "Toggle light and dark",
        group: "Settings",
        keywords: ["dark", "light", "mode", "theme"],
        action: () => {
          const root = document.documentElement;
          const dark =
            root.dataset.theme === "dark" ||
            (!root.dataset.theme && window.matchMedia("(prefers-color-scheme: dark)").matches);
          root.dataset.theme = dark ? "light" : "dark";
          localStorage.setItem("docket-theme", dark ? "light" : "dark");
        },
      },
      {
        id: "settings",
        label: "Settings",
        icon: "settings",
        group: "Settings",
        action: () => router.push("/settings"),
      },
    ],
    [router],
  );

  const matches = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return commands;
    return commands.filter(
      (command) =>
        command.label.toLowerCase().includes(needle) ||
        command.keywords?.some((keyword) => keyword.includes(needle)),
    );
  }, [commands, search]);

  /** Kept in render order so arrow keys and the printed order agree. */
  const groups = useMemo(() => {
    const byHeading = new Map<string, Command[]>();
    for (const command of matches) {
      byHeading.set(command.group, [...(byHeading.get(command.group) ?? []), command]);
    }
    return [...byHeading.entries()];
  }, [matches]);

  const close = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  const show = useCallback(() => {
    setSearch("");
    setSelected(0);
    if (!dialogRef.current?.open) dialogRef.current?.showModal();
  }, []);

  const run = useCallback(
    (command: Command) => {
      close();
      command.action();
    },
    [close],
  );

  // ⌘K from anywhere, and the same request arriving from the bar above the page.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (dialogRef.current?.open) close();
        else show();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(COMMAND_PALETTE_EVENT, show);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(COMMAND_PALETTE_EVENT, show);
    };
  }, [close, show]);

  // Escape is handled by the dialog itself; this keeps React's idea of open in
  // step with the browser's, whichever of the two closed it.
  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    const onClose = () => setOpen(false);
    node.addEventListener("close", onClose);
    return () => node.removeEventListener("close", onClose);
  }, []);

  function onListKey(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelected((index) => (index + 1) % Math.max(matches.length, 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelected((index) => (index - 1 + matches.length) % Math.max(matches.length, 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const command = matches[selected];
      if (command) run(command);
    }
  }

  let cursor = -1;

  return (
    <dialog
      ref={dialogRef}
      className="modal w-[min(94vw,640px)]! max-w-[min(94vw,640px)]! mt-[12vh] mb-auto"
      aria-label="Commands"
      onToggle={() => setOpen(dialogRef.current?.open ?? false)}
      onKeyDown={onListKey}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      {/* Mounted only while the dialog is open, so the input is focused fresh
          every time and the list never holds a stale selection. */}
      {open && (
        <>
          <div className="flex items-center gap-3 border-b border-rule px-5 py-4">
            <SearchGlyph />
            <input
              autoFocus
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setSelected(0);
              }}
              placeholder="Search commands, sections, actions…"
              aria-label="Search commands"
              className="w-full bg-transparent text-base outline-none placeholder:text-faint"
            />
            <span className="kbd">esc</span>
          </div>

          <div className="max-h-[52vh] overflow-y-auto py-2">
            {matches.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted">
                Nothing matches “{search}”.
              </p>
            ) : (
              groups.map(([heading, items]) => (
                <div key={heading}>
                  <p className="eyebrow px-5 pt-3 pb-1.5 text-faint">{heading}</p>
                  {items.map((command) => {
                    cursor += 1;
                    const index = cursor;
                    const active = index === selected;
                    return (
                      <button
                        key={command.id}
                        type="button"
                        onClick={() => run(command)}
                        onMouseEnter={() => setSelected(index)}
                        className={`flex w-full cursor-pointer items-center gap-3 px-5 py-2.5 text-left text-sm transition-colors ${
                          active ? "bg-stamp-wash text-ink" : "text-muted hover:text-ink"
                        }`}
                      >
                        {command.icon ? (
                          <SectionIcon name={command.icon} />
                        ) : (
                          <span className="h-4 w-4 shrink-0" />
                        )}
                        <span className="flex-1">{command.label}</span>
                        {command.shortcut && <span className="kbd">{command.shortcut}</span>}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          <div className="modal-foot justify-start! font-mono text-[11px] text-faint">
            <span>↑↓ move</span>
            <span>↵ run</span>
            <span>esc close</span>
          </div>
        </>
      )}
    </dialog>
  );
}

function SearchGlyph() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      className="h-4 w-4 shrink-0 text-faint"
    >
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5 14 14" />
    </svg>
  );
}
