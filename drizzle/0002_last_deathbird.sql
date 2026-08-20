ALTER TABLE "applications" ADD COLUMN "rejected_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "rejected_at_stage" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "rejection_note" text;--> statement-breakpoint
CREATE INDEX "applications_user_rejected_idx" ON "applications" USING btree ("user_id","rejected_at" DESC NULLS LAST);--> statement-breakpoint
-- Backfill: an entry already sitting in a terminal column was a refusal before
-- there was anywhere to file one. It is stamped with the moment it arrived
-- there, and with the column it came from, so the archive reads correctly from
-- the first time it is opened instead of starting empty next to a board that
-- disagrees with it.
UPDATE "applications" a
SET "rejected_at" = COALESCE(
      (SELECT max(e."occurred_at")
         FROM "status_events" e
        WHERE e."application_id" = a."id" AND e."stage_id" = a."stage_id"),
      a."updated_at"
    ),
    "rejected_at_stage" = (
      SELECT e."stage_name"
        FROM "status_events" e
       WHERE e."application_id" = a."id" AND e."stage_id" IS DISTINCT FROM a."stage_id"
       ORDER BY e."occurred_at" DESC
       LIMIT 1
    )
FROM "stages" s
WHERE s."id" = a."stage_id" AND s."kind" = 'lost' AND a."rejected_at" IS NULL;