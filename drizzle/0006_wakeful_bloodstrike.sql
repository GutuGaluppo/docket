ALTER TABLE "resume_analyses" ADD COLUMN "scoring_version" text DEFAULT '1' NOT NULL;--> statement-breakpoint
ALTER TABLE "resume_analyses" ADD COLUMN "prompt_version" text DEFAULT '1' NOT NULL;