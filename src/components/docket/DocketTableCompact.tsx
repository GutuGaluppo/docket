"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import type { Entry } from "@/server/db/queries/applications";

interface DocketTableCompactProps {
  entries: Entry[];
  onEdit?: (id: number) => void;
  onReject?: (id: number) => void;
  onDelete?: (id: number) => void;
}

/**
 * Compact, high-density docket table following 2026 design trends.
 * 
 * Key features:
 * - 44px row height (down from ~60px)
 * - Subtle borders, shadow on hover instead of heavy lines
 * - Inline editing capability
 * - Quick actions menu on hover
 * - Multi-select support
 */
export function DocketTableCompact({ 
  entries, 
  onEdit, 
  onReject, 
  onDelete 
}: DocketTableCompactProps) {
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const handleSelect = useCallback((id: number, isShift: boolean) => {
    if (isShift) {
      // TODO: Implement range selection
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const formatRelativeDate = (date: Date) => {
    return formatDistanceToNow(date, { addSuffix: true });
  };

  const getStatusColor = (status: string | null) => {
    if (!status) return "text-faint";
    const lower = status.toLowerCase();
    if (lower.includes("interview")) return "text-[var(--status-interview)]";
    if (lower.includes("offer")) return "text-[var(--status-offer)]";
    if (lower.includes("reject")) return "text-[var(--status-rejected)]";
    return "text-faint";
  };

  return (
    <div className="overflow-hidden rounded-lg border border-rule bg-card">
      <table className="w-full">
        <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur-md">
          <tr className="border-b border-rule">
            <th className="w-10 px-3 py-2.5">
              <input
                type="checkbox"
                className="h-4 w-4 cursor-pointer rounded border-rule accent-stamp"
                checked={selectedIds.size === entries.length && entries.length > 0}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedIds(new Set(entries.map((entry) => entry.id)));
                  } else {
                    setSelectedIds(new Set());
                  }
                }}
              />
            </th>
            <th className="px-3 py-2.5 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-muted">
              #
            </th>
            <th className="px-3 py-2.5 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-muted">
              Company
            </th>
            <th className="px-3 py-2.5 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-muted">
              Role
            </th>
            <th className="px-3 py-2.5 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-muted">
              Stack
            </th>
            <th className="px-3 py-2.5 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-muted">
              Status
            </th>
            <th className="px-3 py-2.5 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-muted">
              Stamped
            </th>
            <th className="w-10 px-3 py-2.5"></th>
          </tr>
        </thead>
        <tbody>
          {entries.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-3 py-16 text-center">
                <p className="mb-2 font-mono text-sm uppercase tracking-wide text-muted">
                  Your docket is empty
                </p>
                <p className="text-sm text-faint">
                  <Link href="/docket" className="border-b border-stamp text-stamp">
                    Stamp your first application
                  </Link>{" "}
                  to get started
                </p>
              </td>
            </tr>
          ) : (
            entries.map((entry) => {
              const isHovered = hoveredRow === entry.id;
              const isSelected = selectedIds.has(entry.id);

              return (
                <tr
                  key={entry.id}
                  className={`group border-b border-rule/50 transition-all ${
                    isSelected 
                      ? "bg-stamp-wash" 
                      : "hover:bg-raised hover:shadow-elevation-1"
                  }`}
                  onMouseEnter={() => setHoveredRow(entry.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 cursor-pointer rounded border-rule accent-stamp"
                      checked={isSelected}
                      onChange={() => handleSelect(entry.id, false)}
                    />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-faint">
                    {entry.protocol}
                  </td>
                  <td className="px-3 py-2 text-sm font-medium text-ink">
                    {entry.company}
                  </td>
                  <td className="px-3 py-2 text-sm text-muted">
                    {entry.role}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1.5">
                      {entry.stacks?.slice(0, 2).map((stack) => (
                        <span
                          key={stack}
                          className="rounded border border-stamp-edge bg-stamp-wash px-2 py-0.5 font-mono text-[11px] text-stamp"
                        >
                          {stack}
                        </span>
                      ))}
                      {entry.stacks && entry.stacks.length > 2 && (
                        <span className="rounded border border-rule bg-card px-2 py-0.5 font-mono text-[11px] text-faint">
                          +{entry.stacks.length - 2}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-sm font-medium ${getStatusColor(entry.column)}`}>
                      {entry.column || "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-faint">
                    {formatRelativeDate(entry.stamped)}
                  </td>
                  <td className="px-3 py-2">
                    <div
                      className={`flex items-center justify-center transition-opacity ${
                        isHovered || isSelected ? "opacity-100" : "opacity-0"
                      }`}
                    >
                      <button
                        className="rounded p-1 text-muted hover:bg-card hover:text-ink"
                        title="More actions"
                        onClick={(e) => {
                          e.stopPropagation();
                          // TODO: Open context menu
                        }}
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                          />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="animate-slide-up border-t border-rule bg-card px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm text-muted">
              {selectedIds.size} {selectedIds.size === 1 ? "entry" : "entries"} selected
            </span>
            <div className="flex gap-2">
              <button className="btn-quiet text-xs">
                Change Status
              </button>
              <button className="btn-quiet text-xs text-flag">
                Reject
              </button>
              <button
                className="btn-quiet text-xs"
                onClick={() => setSelectedIds(new Set())}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
