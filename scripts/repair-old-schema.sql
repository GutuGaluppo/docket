-- Repairs a database that was migrated with the FIRST 0000 migration
-- (0000_ancient_zaran, applications.status as an enum, no board, no calendar)
-- up to the current schema, without dropping anything.
--
-- Run this only if `pnpm db:migrate` was applied before the board and calendar
-- landed. On an empty database, ignore this file and run `pnpm db:migrate`.
--
--   psql "$DATABASE_URL_UNPOOLED" -f scripts/repair-old-schema.sql
--
-- It is written to be safe to run twice.

BEGIN;

-- 1. The board's column type -------------------------------------------------

DO $$ BEGIN
  CREATE TYPE "public"."stage_kind" AS ENUM('start', 'middle', 'won', 'lost');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "stages" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "name" text NOT NULL,
  "position" integer NOT NULL,
  "kind" "stage_kind" DEFAULT 'middle' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "stages" ADD CONSTRAINT "stages_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "stages_user_position_idx" ON "stages" ("user_id", "position");

-- Seed the default funnel for everyone who already has an account.
INSERT INTO "stages" ("id", "user_id", "name", "position", "kind")
SELECT gen_random_uuid()::text, u."id", d."name", d."position", d."kind"::"stage_kind"
  FROM "users" u
  CROSS JOIN (VALUES
    ('Application sent', 100, 'start'),
    ('Screening',        200, 'middle'),
    ('Interviewing',     300, 'middle'),
    ('Offer received',   400, 'won'),
    ('Closed',           500, 'lost')
  ) AS d("name", "position", "kind")
 WHERE NOT EXISTS (SELECT 1 FROM "stages" s WHERE s."user_id" = u."id");

-- 2. Calendar feed token -----------------------------------------------------

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "calendar_token" text;

DO $$ BEGIN
  ALTER TABLE "users" ADD CONSTRAINT "users_calendar_token_unique" UNIQUE("calendar_token");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. applications.status -> applications.stage_id ----------------------------

ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "stage_id" text;

DO $$ BEGIN
  ALTER TABLE "applications" ADD CONSTRAINT "applications_stage_id_stages_id_fk"
    FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Carry the old three-value status onto the seeded columns.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'applications' AND column_name = 'status'
  ) THEN
    UPDATE "applications" a
       SET "stage_id" = s."id"
      FROM "stages" s
     WHERE s."user_id" = a."user_id"
       AND a."stage_id" IS NULL
       AND s."name" = CASE a."status"::text
                        WHEN 'applied'   THEN 'Application sent'
                        WHEN 'interview' THEN 'Interviewing'
                        WHEN 'closed'    THEN 'Closed'
                      END;

    ALTER TABLE "applications" DROP COLUMN "status";
  END IF;
END $$;

-- Anything still unassigned lands in the first column.
UPDATE "applications" a
   SET "stage_id" = s."id"
  FROM "stages" s
 WHERE s."user_id" = a."user_id"
   AND s."kind" = 'start'
   AND a."stage_id" IS NULL;

CREATE INDEX IF NOT EXISTS "applications_stage_idx" ON "applications" ("stage_id");

-- 4. status_events.status -> stage_id + stage_name ---------------------------

ALTER TABLE "status_events" ADD COLUMN IF NOT EXISTS "stage_id" text;
ALTER TABLE "status_events" ADD COLUMN IF NOT EXISTS "stage_name" text;

DO $$ BEGIN
  ALTER TABLE "status_events" ADD CONSTRAINT "status_events_stage_id_stages_id_fk"
    FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'status_events' AND column_name = 'status'
  ) THEN
    UPDATE "status_events" e
       SET "stage_name" = CASE e."status"::text
                            WHEN 'applied'   THEN 'Application sent'
                            WHEN 'interview' THEN 'Interviewing'
                            WHEN 'closed'    THEN 'Closed'
                            ELSE 'Application sent'
                          END
     WHERE e."stage_name" IS NULL;

    UPDATE "status_events" e
       SET "stage_id" = s."id"
      FROM "applications" a
      JOIN "stages" s ON s."user_id" = a."user_id"
     WHERE e."application_id" = a."id"
       AND s."name" = e."stage_name"
       AND e."stage_id" IS NULL;

    ALTER TABLE "status_events" DROP COLUMN "status";
  END IF;
END $$;

UPDATE "status_events" SET "stage_name" = 'Application sent' WHERE "stage_name" IS NULL;
ALTER TABLE "status_events" ALTER COLUMN "stage_name" SET NOT NULL;

-- 5. Interviews --------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "interviews" (
  "id" text PRIMARY KEY NOT NULL,
  "application_id" text NOT NULL,
  "title" text NOT NULL,
  "starts_at" timestamp with time zone NOT NULL,
  "duration_minutes" integer DEFAULT 60 NOT NULL,
  "location" text,
  "notes" text,
  "timezone" text,
  "remind_minutes" integer DEFAULT 60 NOT NULL,
  "uid" text NOT NULL,
  "sequence" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "interviews" ADD CONSTRAINT "interviews_application_id_applications_id_fk"
    FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "interviews_application_starts_idx"
  ON "interviews" ("application_id", "starts_at");

-- 6. The old enum is unreferenced now ----------------------------------------

DROP TYPE IF EXISTS "public"."application_status";

-- 7. Tell drizzle the current migration is applied ---------------------------
-- Without this, `pnpm db:migrate` would try to run 0000 again and fail on
-- tables that already exist. The hash is sha256 of drizzle/0000_glorious_zombie.sql
-- and the timestamp is `when` from drizzle/meta/_journal.json.

CREATE SCHEMA IF NOT EXISTS "drizzle";
CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
  id SERIAL PRIMARY KEY,
  hash text NOT NULL,
  created_at bigint
);

DELETE FROM "drizzle"."__drizzle_migrations";
INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at")
VALUES ('c266ec1af657f53f37c8a5982dd3faae0ad22ff76663f83301b5ebe2bae31a75', 1786983195567);

COMMIT;
