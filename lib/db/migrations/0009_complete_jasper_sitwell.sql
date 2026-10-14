CREATE TABLE "companies" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"domain" text,
	"industry" text,
	"size_band" text,
	"location" text,
	"country_code" text,
	"signals" jsonb,
	"origin" text NOT NULL,
	"origin_id" text,
	"last_discovered_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discovery_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"input" jsonb NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"message" text,
	"started_at" timestamp,
	"finished_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"name" text NOT NULL,
	"title" text,
	"seniority" text DEFAULT 'other' NOT NULL,
	"email" text,
	"email_status" text DEFAULT 'unknown' NOT NULL,
	"phone" text,
	"linkedin_url" text,
	"score" integer,
	"score_reasons" jsonb,
	"status" text DEFAULT 'new' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "people_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"person_id" text,
	"company_id" text,
	"field" text NOT NULL,
	"value" text,
	"source_url" text,
	"source_type" text NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people_sources" ADD CONSTRAINT "people_sources_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people_sources" ADD CONSTRAINT "people_sources_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "companies_domain_idx" ON "companies" USING btree ("domain");--> statement-breakpoint
CREATE UNIQUE INDEX "people_company_name_idx" ON "people" USING btree ("company_id","name");--> statement-breakpoint
CREATE INDEX "people_score_idx" ON "people" USING btree ("score");--> statement-breakpoint
CREATE INDEX "people_sources_person_idx" ON "people_sources" USING btree ("person_id");