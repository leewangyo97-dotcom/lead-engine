ALTER TABLE "outreach" ADD COLUMN "to_address" text;--> statement-breakpoint
ALTER TABLE "outreach" ADD COLUMN "person_id" text;--> statement-breakpoint
ALTER TABLE "outreach" ADD CONSTRAINT "outreach_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;