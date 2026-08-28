ALTER TABLE "resume_imports" DROP CONSTRAINT "resume_imports_resume_id_resumes_id_fk";
--> statement-breakpoint
ALTER TABLE "resume_analyses" ADD COLUMN "resume_fingerprint" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "resume_analyses" ADD COLUMN "job_fingerprint" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "resumes" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "resumes" ADD COLUMN "original_file_name" text;--> statement-breakpoint
ALTER TABLE "resumes" ADD COLUMN "last_used_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "active_resume_id" text;--> statement-breakpoint
ALTER TABLE "resume_imports" ADD CONSTRAINT "resume_imports_resume_id_resumes_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."resumes"("id") ON DELETE cascade ON UPDATE no action;