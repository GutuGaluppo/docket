"use client";

import { useState, useTransition } from "react";

import type { BoardColumn, Stage } from "@/server/db/queries/board";
import {
  addStage,
  editStage,
  moveApplication,
  removeStage,
  reorderStage,
} from "@/server/actions/board";
import { BoardCard } from "./BoardCard";

export function Board({ columns }: { columns: BoardColumn[] }) {
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  const stages = columns.map((column) => column.stage);

  function run(work: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    setError("");
    setNotice("");
    startTransition(async () => {
      const result = await work();
      if (!result.ok) setError(result.error ?? "That did not work.");
      else if (result.message) setNotice(result.message);
    });
  }

  function onDrop(stageId: string, event: React.DragEvent) {
    event.preventDefault();
    setDragOver(null);
    const applicationId = event.dataTransfer.getData("text/plain");
    if (!applicationId) return;
    run(() => moveApplication({ applicationId, stageId }));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3" aria-live="polite">
        {error && <span className="font-mono text-xs text-flag">{error}</span>}
        {notice && <span className="font-mono text-xs text-stamp">{notice}</span>}
      </div>

      {/* The board scrolls sideways on its own; the page never does. */}
      <div className="-mx-5 overflow-x-auto px-5 pb-3">
        <div className="flex min-w-max items-start gap-4">
          {columns.map((column, index) => (
            <section
              key={column.stage.id}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOver(column.stage.id);
              }}
              onDragLeave={() => setDragOver((id) => (id === column.stage.id ? null : id))}
              onDrop={(event) => onDrop(column.stage.id, event)}
              className={`flex w-[264px] flex-none flex-col gap-3 rounded-[3px] border p-3 transition-colors ${
                dragOver === column.stage.id ? "border-stamp bg-stamp-wash" : "border-rule bg-card"
              }`}
            >
              <header className="flex flex-col gap-2 border-b border-rule pb-2">
                {editing === column.stage.id ? (
                  <form
                    suppressHydrationWarning
                    className="flex items-center gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      setEditing(null);
                      run(() => editStage({ id: column.stage.id, name: draft }));
                    }}
                  >
                    <input
                      autoFocus
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onBlur={() => setEditing(null)}
                      aria-label={`Rename ${column.stage.name}`}
                      suppressHydrationWarning
                      className="field-input text-sm"
                    />
                  </form>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="eyebrow text-ink">{column.stage.name}</h2>
                    <span className="font-mono text-xs text-muted">{column.cards.length}</span>
                  </div>
                )}

                <div
                  className="flex items-center gap-2 font-mono text-[10px] tracking-[0.08em] text-faint uppercase"
                  suppressHydrationWarning
                >
                  <button
                    type="button"
                    disabled={pending || index === 0}
                    onClick={() =>
                      run(() => reorderStage({ id: column.stage.id, direction: "left" }))
                    }
                    className="cursor-pointer hover:text-stamp disabled:cursor-default disabled:opacity-40"
                    aria-label={`Move ${column.stage.name} left`}
                    suppressHydrationWarning
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    disabled={pending || index === columns.length - 1}
                    onClick={() =>
                      run(() => reorderStage({ id: column.stage.id, direction: "right" }))
                    }
                    className="cursor-pointer hover:text-stamp disabled:cursor-default disabled:opacity-40"
                    aria-label={`Move ${column.stage.name} right`}
                    suppressHydrationWarning
                  >
                    →
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      setDraft(column.stage.name);
                      setEditing(column.stage.id);
                    }}
                    className="cursor-pointer hover:text-stamp"
                    suppressHydrationWarning
                  >
                    Rename
                  </button>
                  {column.stage.kind === "middle" && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => removeStage({ id: column.stage.id }))}
                      className="cursor-pointer hover:text-flag"
                      suppressHydrationWarning
                    >
                      Remove
                    </button>
                  )}
                </div>
              </header>

              <div className="flex min-h-24 flex-col gap-2">
                {column.cards.length === 0 ? (
                  <p className="py-6 text-center font-mono text-[11px] text-faint">
                    Drop an entry here
                  </p>
                ) : (
                  column.cards.map((card) => (
                    <BoardCard
                      key={card.id}
                      card={card}
                      stages={stages as Stage[]}
                      currentStageId={column.stage.id}
                    />
                  ))
                )}
              </div>
            </section>
          ))}

          {/* Adding a column sits at the end of the row, where a new one lands. */}
          <div
            suppressHydrationWarning
            className="flex w-[220px] flex-none flex-col gap-2 rounded-[3px] border border-dashed border-rule p-3"
          >
            {adding ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const name = newName;
                  setNewName("");
                  setAdding(false);
                  run(() => addStage({ name }));
                }}
                suppressHydrationWarning
                className="flex flex-col gap-2"
              >
                <input
                  autoFocus
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder="e.g. Take-home task"
                  aria-label="Name of the new column"
                  suppressHydrationWarning
                  className="field-input text-sm"
                />
                <button type="submit" className="btn btn-quiet" disabled={pending}>
                  Add column
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                disabled={pending}
                className="cursor-pointer py-6 font-mono text-[11px] tracking-[0.08em] text-muted uppercase hover:text-stamp"
                suppressHydrationWarning
              >
                + Add column
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
