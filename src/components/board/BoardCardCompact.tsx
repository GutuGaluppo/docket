"use client";

import { formatDistanceToNow } from "date-fns";
import type { Entry } from "@/server/db/queries/applications";

interface BoardCardCompactProps {
  entry: Entry;
  onOpen?: () => void;
  isDragging?: boolean;
}

/**
 * Compact board card following 2026 design trends.
 * 
 * Key features:
 * - Subtle shadow instead of border
 * - Lifts on hover (elevation-2)
 * - Shows essentials: protocol, role, company
 * - Smart metadata: 2 visible stacks, "+N more" for rest
 * - Quick actions appear on hover
 */
export function BoardCardCompact({ 
  entry, 
  onOpen,
  isDragging = false 
}: BoardCardCompactProps) {
  const formatRelativeDate = (date: Date) => {
    return formatDistanceToNow(date, { addSuffix: true });
  };

  return (
    <div
      className={`group relative cursor-pointer rounded-lg bg-raised p-3 shadow-elevation-1 transition-all hover:shadow-elevation-2 hover:-translate-y-0.5 ${
        isDragging ? "opacity-50 rotate-2" : ""
      }`}
      onClick={onOpen}
    >
      {/* Header: Protocol + Quick Actions */}
      <div className="mb-2 flex items-start justify-between">
        <span className="font-mono text-[11px] text-faint">
          #{entry.protocol}
        </span>
        <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {entry.notes && (
            <button
              className="rounded p-1 hover:bg-card"
              title="Has notes"
              onClick={(e) => {
                e.stopPropagation();
                onOpen?.();
              }}
            >
              <svg
                className="h-3.5 w-3.5 text-muted"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </button>
          )}
          {entry.interview && (
            <button
              className="rounded p-1 hover:bg-card"
              title="Interview scheduled"
              onClick={(e) => {
                e.stopPropagation();
                onOpen?.();
              }}
            >
              <svg
                className="h-3.5 w-3.5 text-stamp"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Title: Role */}
      <h3 className="mb-1 text-sm font-semibold leading-tight text-ink line-clamp-2">
        {entry.role}
      </h3>

      {/* Company */}
      <p className="mb-3 text-sm text-muted">
        {entry.company}
      </p>

      {/* Metadata: Stacks */}
      {entry.stacks && entry.stacks.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {entry.stacks.slice(0, 2).map((stack) => (
            <span
              key={stack}
              className="rounded border border-stamp-edge bg-stamp-wash px-1.5 py-0.5 font-mono text-[10px] text-stamp"
            >
              {stack}
            </span>
          ))}
          {entry.stacks.length > 2 && (
            <span className="rounded border border-rule bg-card px-1.5 py-0.5 font-mono text-[10px] text-faint">
              +{entry.stacks.length - 2}
            </span>
          )}
        </div>
      )}

      {/* Footer: Timestamp */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] text-faint">
          {formatRelativeDate(entry.stamped)}
        </span>
      </div>

      {/* Drag handle indicator */}
      <div className="absolute left-2 top-2 opacity-0 transition-opacity group-hover:opacity-30">
        <svg
          className="h-4 w-4 text-muted"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 8h16M4 16h16"
          />
        </svg>
      </div>
    </div>
  );
}
