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
      className={`group flex cursor-grab flex-col gap-2.5 rounded-lg border bg-raised p-3.5 transition-all duration-200 active:cursor-grabbing ${
        pending ? "opacity-55" : ""
      } ${
        dragging 
          ? "rotate-[-2deg] scale-105 shadow-elevation-3 border-stamp" 
          : "border-rule shadow-elevation-1 hover:shadow-elevation-2 hover:-translate-y-0.5"
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[10px] text-faint group-hover:text-muted transition-colors">
          {protocolNumber(card.protocolNumber)}
        </span>
        {card.nextInterviewAt && (
          <span className="inline-flex items-center gap-1 rounded-full bg-stamp-wash px-2 py-0.5 font-mono text-[9px] font-semibold tracking-wider text-stamp uppercase border border-stamp-edge">
            <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(
              card.nextInterviewAt,
            )}
          </span>
        )}
      </div>

      {/* The card's face opens the dossier; the select below it and the drag
          handler on the article are untouched, so the three ways to use a card
          do not compete for the same gesture. */}
      <DossierTrigger 
        id={card.id} 
        label={`${card.company} — ${card.position}`} 
        className="w-full group/trigger"
      >
        <span className="block text-sm font-semibold leading-tight group-hover/trigger:text-stamp transition-colors">
          {card.company}
        </span>
        <span className="mt-1.5 block text-xs leading-tight text-muted group-hover/trigger:text-ink transition-colors">
          {card.position}
        </span>
      </DossierTrigger>

      {card.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {card.tags.slice(0, 2).map((tag) => (
            <span 
              key={tag} 
              className="rounded border border-stamp-edge bg-stamp-wash px-1.5 py-0.5 font-mono text-[10px] text-stamp"
            >
              {tag}
            </span>
          ))}
          {card.tags.length > 2 && (
            <span className="rounded border border-rule bg-card px-1.5 py-0.5 font-mono text-[10px] text-faint">
              +{card.tags.length - 2}
            </span>
          )}
        </div>
      )}

      <label className="mt-0.5 flex flex-col gap-1" suppressHydrationWarning>
        <span className="sr-only">
          Move {card.company} — {card.position} to another column
        </span>
        <select
          value={currentStageId}
          disabled={pending}
          suppressHydrationWarning
          onChange={(event) => moveTo(event.target.value)}
          className="w-full cursor-pointer rounded border border-rule bg-card px-2 py-1.5 font-mono text-[10px] tracking-wider uppercase text-muted hover:border-stamp hover:bg-raised focus:border-stamp focus:outline-none focus:ring-2 focus:ring-stamp-wash transition-all"
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
