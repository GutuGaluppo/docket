import { runFollowUps } from "@/server/email/follow-ups";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * The scheduled follow-up run.
 *
 * This endpoint sends email, so it is not open. Vercel Cron attaches
 * `Authorization: Bearer $CRON_SECRET` when that variable is set; without the
 * secret configured the route refuses to run at all rather than falling back to
 * "anyone may trigger it" — an unauthenticated mail sender on a public domain
 * is a spam relay with extra steps.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return Response.json(
      { error: "CRON_SECRET is not set. The job refuses to run unauthenticated." },
      { status: 503 },
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Not found", { status: 404 });
  }

  const report = await runFollowUps();
  return Response.json(report, { headers: { "cache-control": "no-store" } });
}
