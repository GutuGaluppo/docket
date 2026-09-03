CREATE TABLE "application_benefits" (
	"application_id" text NOT NULL,
	"benefit" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "application_benefits_application_id_benefit_pk" PRIMARY KEY("application_id","benefit")
);
--> statement-breakpoint
ALTER TABLE "application_benefits" ADD CONSTRAINT "application_benefits_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "application_benefits_benefit_idx" ON "application_benefits" USING btree ("benefit");