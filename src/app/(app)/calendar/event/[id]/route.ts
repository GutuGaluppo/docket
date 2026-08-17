import { buildCalendar } from "@/lib/calendar/ics";
import { getScope } from "@/server/auth/session";
import { getInterview } from "@/server/db/queries/interviews";

/**
 * A single event as a downloadable .ics. Opening it adds the interview to
 * whichever calendar app the machine has — the one-off counterpart to the
 * subscription feed, for people who would rather not subscribe to anything.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const scope = await getScope();
  if (!scope) return new Response("Sign in first.", { status: 401 });

  const { id } = await context.params;
  const item = await getInterview(scope, id.replace(/\.ics$/, ""));
  if (!item) return new Response("Not found", { status: 404 });

  const ics = buildCalendar(
    [
      {
        uid: item.uid,
        sequence: item.sequence,
        title: `${item.title} — ${item.company}`,
        startsAt: item.startsAt,
        durationMinutes: item.durationMinutes,
        location: item.location,
        description: [item.position, item.notes].filter(Boolean).join("\n") || null,
        remindMinutes: item.remindMinutes,
      },
    ],
    { name: item.title },
  );

  const slug = item.company.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return new Response(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="docket-${slug || "interview"}.ics"`,
      "cache-control": "no-store",
    },
  });
}
