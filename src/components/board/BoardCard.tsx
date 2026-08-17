"use client";

import { useTransition } from "react";

import type { BoardCard as Card, Stage } from "@/server/db/queries/board";
import { protocolNumber } from "@/lib/format";
import { moveApplication } from "@/server/actions/board";

/**
 * A card carries two ways to move, and both matter.
 *
 * The select is the real control: it is reachable by keyboard, readable by a
 * screen reader, and works on a phone. The drag handler is native HTML5, no
 * library, and exists because a board that cannot be dragged does not feel
 * like a board. Neither is a fallback for the other.
 */
export function BoardCard({
  card,
  stages,
  currentStageId,
}: {
  card: Card;
  stages: readonly Stage[];
  currentStageId: string;
}) {
  const [pending, startTransition] = useTransition();

  function moveTo(stageId: string) {
    if (stageId === currentStageId) return;
    startTransition(async () => {
      await moveApplication({ applicationId: card.id, stageId });
    });
  }

  return (
    <article
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", card.id);
        event.dataTransfer.effectAllowed = "move";
      }}
      aria-busy={pending}
      className={`flex cursor-grab flex-col gap-2 rounded-[3px] border border-rule bg-sheet p-3 active:cursor-grabbing ${
        pending ? "opacity-55" : ""
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-xs text-muted">{protocolNumber(card.protocolNumber)}</span>
        {card.nextInterviewAt && (
          <span className="font-mono text-[10px] tracking-[0.1em] text-stamp uppercase">
            {new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(
              card.nextInterviewAt,
            )}
          </span>
        )}
      </div>

      <p className="text-sm font-semibold">{card.company}</p>
      <p className="text-xs text-muted">{card.position}</p>

      {card.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {card.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="tag text-[11px]">
              {tag}
            </span>
          ))}
          {card.tags.length > 3 && (
            <span className="font-mono text-[11px] text-faint">+{card.tags.length - 3}</span>
          )}
        </div>
      )}

      <label className="mt-1 flex flex-col gap-1" suppressHydrationWarning>
        <span className="sr-only">
          Move {card.company} — {card.position} to another column
        </span>
        <select
          value={currentStageId}
          disabled={pending}
          suppressHydrationWarning
          onChange={(event) => moveTo(event.target.value)}
          className="w-full cursor-pointer rounded-[2px] border border-rule bg-card px-2 py-1.5 font-mono text-[11px] tracking-[0.06em] uppercase focus:border-stamp focus:outline-none"
        >
          {stages.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.name}
            </option>
          ))}
        </select>
      </label>
    </article>
  );
}
