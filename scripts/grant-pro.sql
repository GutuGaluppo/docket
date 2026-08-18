-- Put one account on Pro, by email.
--
-- The caps in src/server/billing/limits.ts are live before checkout exists, and
-- they apply to every account without exception — including the one that owns
-- the register. There is no admin screen and deliberately no back door in the
-- application: an entitlement that can be granted from inside the product is an
-- entitlement an attacker can grant themselves. Granting one is a database
-- operation, which is a thing only whoever holds the connection string can do.
--
-- Section 7 also describes a second use: the standing 100% coupon for anyone
-- unemployed longer than six months, asked for by email and answered by hand.
-- That request arrives through the contact form and is settled with this file —
-- no coupon code exists to leak, and nothing has to be built for it.
--
-- Usage:
--   psql "$DATABASE_URL_UNPOOLED" -v email="'you@example.com'" -f scripts/grant-pro.sql
--
-- To take it back, run scripts/grant-pro.sql with plan 'free' edited in, or
-- simply delete the row: getPlan() reads a missing row as the free plan.

\set ON_ERROR_STOP on

insert into subscriptions (user_id, provider, plan, status, updated_at)
select u.id, 'manual', 'pro', 'active', now()
  from users u
 where u.email = :email
on conflict (user_id) do update
   set plan       = 'pro',
       status     = 'active',
       provider   = 'manual',
       -- period_end stays null: a manual grant has no billing period to end.
       period_end = null,
       updated_at = now();

-- Reports what happened, so a typo in the address is visible rather than silent.
select u.email,
       coalesce(s.plan::text, 'free')   as plan,
       coalesce(s.status::text, '—')    as status,
       coalesce(s.provider, '—')        as provider
  from users u
  left join subscriptions s on s.user_id = u.id
 where u.email = :email;
