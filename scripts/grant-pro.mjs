#!/usr/bin/env node
/**
 * Puts one account on Pro, or takes it back off.
 *
 *   node scripts/grant-pro.mjs you@example.com
 *   node scripts/grant-pro.mjs you@example.com --revoke
 *
 * Same operation as scripts/grant-pro.sql, which is the version to paste into
 * the Neon console. This one exists because it needs nothing installed: the `pg`
 * driver is already a dependency of the migration step, so there is no psql to
 * set up on a machine that does not have one.
 *
 * Why this is a script and not a screen: the caps in src/server/billing/limits.ts
 * apply to every account without exception, including the one that owns the
 * register. An entitlement that can be granted from inside the product is an
 * entitlement an attacker can grant themselves, so granting one is a database
 * operation — something only whoever holds the connection string can do.
 *
 * It also settles section 7's standing coupon for anyone unemployed longer than
 * six months: the request arrives through the contact form and is answered here.
 * No coupon code exists, so none can leak.
 */
import { readFileSync } from "node:fs";
import { Client } from "pg";

const CONNECTION = "DATABASE_URL_UNPOOLED";

/** Reads .env.local only for what the shell did not already provide. */
function loadEnvFile(path = ".env.local") {
  if (process.env[CONNECTION]) return;
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return;
  }
  for (const line of text.split("\n")) {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/i);
    if (!match) continue;
    const [, key, raw] = match;
    if (process.env[key]) continue;
    process.env[key] = raw.trim().replace(/^["']|["']$/g, "");
  }
}

const [email, ...flags] = process.argv.slice(2);
const revoke = flags.includes("--revoke");

if (!email || !email.includes("@")) {
  console.error("Usage: node scripts/grant-pro.mjs <email> [--revoke]");
  process.exit(1);
}

loadEnvFile();
const connectionString = process.env[CONNECTION];
if (!connectionString) {
  console.error(
    `${CONNECTION} is not set, and .env.local does not define it.\n` +
      "It is the direct Neon endpoint — the one without `-pooler` in the host.",
  );
  process.exit(1);
}

const client = new Client({ connectionString });

try {
  await client.connect();
} catch (error) {
  // A dump of the driver's stack helps nobody here; the two things that go
  // wrong are the wrong endpoint and a password that was not copied whole.
  console.error(`Could not connect: ${error instanceof Error ? error.message : error}`);
  console.error(
    `Check that ${CONNECTION} is the direct endpoint — the same string as ` +
      "DATABASE_URL, character for character, with only `-pooler` removed.",
  );
  process.exit(1);
}

try {
  const { rows: users } = await client.query("select id from users where email = $1", [email]);
  const user = users[0];
  if (!user) {
    // A typo in the address must not look like a successful grant.
    console.error(`No account with the address ${email}.`);
    process.exit(1);
  }

  if (revoke) {
    // Deleting the row rather than writing 'free': getPlan() reads a missing
    // row as the free plan, so this leaves no manual grant to explain later.
    await client.query("delete from subscriptions where user_id = $1", [user.id]);
  } else {
    await client.query(
      `insert into subscriptions (user_id, provider, plan, status, updated_at)
            values ($1, 'manual', 'pro', 'active', now())
       on conflict (user_id) do update
              set plan = 'pro', status = 'active', provider = 'manual',
                  period_end = null, updated_at = now()`,
      [user.id],
    );
  }

  const { rows } = await client.query(
    `select u.email,
            coalesce(s.plan::text, 'free') as plan,
            coalesce(s.status::text, '—')  as status,
            coalesce(s.provider, '—')      as provider
       from users u
       left join subscriptions s on s.user_id = u.id
      where u.email = $1`,
    [email],
  );
  console.table(rows);
} finally {
  await client.end();
}
