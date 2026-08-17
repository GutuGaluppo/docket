CREATE TABLE "reminders" (
	"id" text PRIMARY KEY NOT NULL,
	"application_id" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "follow_up_days" integer;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reminders_application_idx" ON "reminders" USING btree ("application_id");