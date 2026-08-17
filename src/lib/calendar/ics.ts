/**
 * iCalendar (RFC 5545) output.
 *
 * This is the integration with Google Calendar and Apple Calendar. Neither is
 * reached through a private API here, and that is a deliberate choice:
 *
 *  - Apple has no public write API for Calendar. The supported paths are ICS
 *    subscription and CalDAV, and CalDAV means asking people for an
 *    app-specific password, which we will not do.
 *  - Google can be written to over OAuth, but that covers one of the two, needs
 *    token storage and refresh, and still leaves Apple on ICS.
 *
 * One subscribable feed serves both, updates itself, needs no credentials from
 * the user, and keeps working if they switch clients. Alerts ride along as
 * VALARM, which both clients honour.
 */

export type CalendarEvent = {
  uid: string;
  sequence: number;
  title: string;
  startsAt: Date;
  durationMinutes: number;
  location: string | null;
  description: string | null;
  /** Minutes before the start. Zero or less means no alarm. */
  remindMinutes: number;
};

/** RFC 5545 escaping: backslash, semicolon, comma and newline are special. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** UTC basic format, e.g. 20260817T134500Z. */
export function toIcsUtc(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

/**
 * Lines must not exceed 75 octets. Continuations start with a single space,
 * and the split counts bytes rather than characters so a multi-byte glyph is
 * never cut in half.
 */
export function foldLine(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;

  const out: string[] = [];
  let start = 0;
  let limit = 75;

  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    // Back off until the slice ends on a character boundary.
    while (end > start && end < bytes.length && (bytes[end] ?? 0) >= 0x80 && (bytes[end] ?? 0) < 0xc0) {
      end -= 1;
    }
    out.push(new TextDecoder().decode(bytes.slice(start, end)));
    start = end;
    limit = 74; // continuation lines carry a leading space
  }

  return out.join("\r\n ");
}

function event(item: CalendarEvent, stamp: Date): string[] {
  const end = new Date(item.startsAt.getTime() + item.durationMinutes * 60_000);
  const lines = [
    "BEGIN:VEVENT",
    `UID:${item.uid}`,
    `SEQUENCE:${item.sequence}`,
    `DTSTAMP:${toIcsUtc(stamp)}`,
    `DTSTART:${toIcsUtc(item.startsAt)}`,
    `DTEND:${toIcsUtc(end)}`,
    `SUMMARY:${escapeText(item.title)}`,
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
  ];

  if (item.location) lines.push(`LOCATION:${escapeText(item.location)}`);
  if (item.description) lines.push(`DESCRIPTION:${escapeText(item.description)}`);

  if (item.remindMinutes > 0) {
    lines.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `TRIGGER:-PT${item.remindMinutes}M`,
      `DESCRIPTION:${escapeText(item.title)}`,
      "END:VALARM",
    );
  }

  lines.push("END:VEVENT");
  return lines;
}

export function buildCalendar(
  events: readonly CalendarEvent[],
  options: { name?: string; stamp?: Date } = {},
): string {
  const stamp = options.stamp ?? new Date();
  const name = options.name ?? "Docket — interviews";

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Docket//Interview register//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(name)}`,
    // Apple and Google both read this as "do not poll more often than".
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
    ...events.flatMap((item) => event(item, stamp)),
    "END:VCALENDAR",
  ];

  // CRLF is required by the spec; some clients reject bare LF.
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
