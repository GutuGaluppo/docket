"use client";

import { useState, useTransition } from "react";

import type { BoardCard as Card, Stage } from "@/server/db/queries/board";
import { protocolNumber } from "@/lib/format";
import { moveApplication } from "@/server/actions/board";
import { DossierTrigger } from "@/components/docket/DossierTrigger";

/**
 * A card carries two ways to move, and both matter.
 *
 * The select is the real control: it is reachable by keyboard, readable by a
 * screen reader, and works on a phone. The drag handler is native HTML5, no
 * library, and exists because a board that cannot be dragged does not feel
 * like a board. Neither is a fallback for the other.
 *
 * While a card is being dragged it tilts. The tilt is on the card left behind
 * in the column, not on the ghost the cursor carries: that ghost is a bitmap
 * the browser snapshots when the drag begins, before React has re-rendered
 * anything, so it cannot be styled after the fact. What the tilt buys is the
 * answer to "which one am I holding?" — with the ghost translucent and the
 * columns otherwise unchanged, the card that lifted off the page is the only
 * thing on screen saying so.
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
  const [dragging, setDragging] = useState(false);

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
        setDragging(true);
      }}
      // Fires on the source card after a drop and after a cancelled drag alike,
      // which is the only event that reliably ends a drag — a card dropped
      // outside any column never hears about it otherwise, and would stay tilted.
      onDragEnd={() => setDragging(false)}
      aria-busy={pending}
      className={`flex cursor-grab flex-col gap-2 rounded-[3px] border border-rule bg-sheet p-3 transition-transform duration-150 active:cursor-grabbing ${
        pending ? "opacity-55" : ""
      } ${dragging ? "rotate-[-15deg] shadow-paper" : ""}`}
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

      {/* The card's face opens the dossier; the select below it and the drag
          handler on the article are untouched, so the three ways to use a card
          do not compete for the same gesture. */}
      <DossierTrigger id={card.id} label={`${card.company} — ${card.position}`} className="w-full">
        <span className="block text-sm font-semibold">{card.company}</span>
        <span className="mt-2 block text-xs text-muted">{card.position}</span>
      </DossierTrigger>

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
