/**
 * The stamp reads as a record, not as a friendly timestamp: 24-hour clock,
 * zero-padded numbers, and the timezone the entry was created in — so an entry
 * stamped in Berlin still says 23:41 when read from São Paulo.
 */
export function formatStamp(date: Date, timezone?: string | null): { date: string; time: string } {
  const options: Intl.DateTimeFormatOptions = timezone ? { timeZone: timezone } : {};
  return {
    date: new Intl.DateTimeFormat("en-GB", {
      ...options,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date),
    time: new Intl.DateTimeFormat("en-GB", {
      ...options,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date),
  };
}

/** "today" / "yesterday" / "12 days ago" — the waiting, said plainly. */
export function elapsed(date: Date, now: Date = new Date()): string {
  const days = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

export const protocolNumber = (n: number) => String(n).padStart(3, "0");
