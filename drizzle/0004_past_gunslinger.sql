CREATE TABLE "resume_imports" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"resume_id" text,
	"file_name" text NOT NULL,
	"byte_size" integer NOT NULL,
	"page_count" integer DEFAULT 0 NOT NULL,
	"checksum" text NOT NULL,
	"file_data" text,
	"extracted_text" text DEFAULT '' NOT NULL,
	"result" jsonb NOT NULL,
	"status" text DEFAULT 'review' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resume_imports" ADD CONSTRAINT "resume_imports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_imports" ADD CONSTRAINT "resume_imports_resume_id_resumes_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."resumes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "resume_imports_user_created_idx" ON "resume_imports" USING btree ("user_id","created_at" DESC NULLS LAST);