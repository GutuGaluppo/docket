import { defineConfig } from "drizzle-kit";

/**
 * Migrations need a direct connection. Neon's pooled endpoint (the one with
 * `-pooler` in the host) is PgBouncer in transaction mode, which does not
 * support the session-level SET and PREPARE that drizzle-kit issues.
 *
 * DATABASE_URL_UNPOOLED is the name Neon's Vercel integration already uses for
 * the direct string, so nothing extra has to be configured there.
 */
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  throw new Error("Set DATABASE_URL_UNPOOLED (preferred) or DATABASE_URL to run drizzle-kit");
}
if (url.includes("-pooler.")) {
  console.warn(
    "\n  drizzle-kit is pointed at Neon's pooled endpoint. Migrations can fail there.\n" +
      "  Set DATABASE_URL_UNPOOLED to the same string without `-pooler` in the host.\n",
  );
}

export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
