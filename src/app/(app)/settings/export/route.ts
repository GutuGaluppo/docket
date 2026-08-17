import { exportAccount } from "@/server/db/queries/account";
import { getScope } from "@/server/auth/session";

/** Everything we hold about you, in one file. No filtering, no throttling. */
export async function GET() {
  const scope = await getScope();
  if (!scope) return new Response("Sign in first.", { status: 401 });

  const data = await exportAccount(scope);
  const filename = `docket-export-${data.exportedAt.slice(0, 10)}.json`;

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
