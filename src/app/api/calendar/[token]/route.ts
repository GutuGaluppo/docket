import { buildCalendar, type CalendarEvent } from "@/lib/calendar/ics";
import { listInterviewsByFeedToken } from "@/server/db/queries/interviews";

/**
 * The subscription endpoint. Apple Calendar and Google Calendar fetch this
 * without a session, so the token in the path is the credential — hence no
 * enumeration hints in the response and no caching by anything in front of us.
 */
export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const feed = await listInterviewsByFeedToken(token.replace(/\.ics$/, ""));

  // Same answer for a wrong token and an unknown one.
  if (!feed) return new Response("Not found", { status: 404 });

  const events: CalendarEvent[] = feed.interviews.map((item) => ({
    uid: item.uid,
    sequence: item.sequence,
    title: `${item.title} — ${item.company}`,
    startsAt: item.startsAt,
    durationMinutes: item.durationMinutes,
    location: item.location,
    description: [item.position, item.notes].filter(Boolean).join("\n") || null,
    remindMinutes: item.remindMinutes,
  }));

  return new Response(buildCalendar(events, { name: "Docket — interviews" }), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'inline; filename="docket-interviews.ics"',
      "cache-control": "no-store, private",
      "x-robots-tag": "noindex",
    },
  });
}
