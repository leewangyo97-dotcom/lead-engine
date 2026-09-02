CREATE TYPE "public"."enrichment_status" AS ENUM('pending', 'enriched', 'no_website', 'fetch_failed', 'robots_blocked', 'no_contact_found');--> statement-breakpoint
CREATE TYPE "public"."prospect_status" AS ENUM('new', 'queued', 'contacted', 'replied', 'won', 'lost', 'do_not_contact');--> statement-breakpoint
CREATE TYPE "public"."search_status" AS ENUM('queued', 'discovering', 'enriching', 'complete', 'failed');--> statement-breakpoint
CREATE TABLE "prospects" (
	"id" text PRIMARY KEY NOT NULL,
	"search_id" text NOT NULL,
	"source_id" text NOT NULL,
	"source_provider" text NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"category" text NOT NULL,
	"website" text,
	"root_domain" text,
	"address_line" text,
	"city" text,
	"country_code" text,
	"lat" double precision,
	"lon" double precision,
	"email" text,
	"email_confidence" text,
	"phone_e164" text,
	"whatsapp_e164" text,
	"facebook_url" text,
	"instagram_url" text,
	"linkedin_url" text,
	"contact_name" text,
	"enrichment_status" "enrichment_status" DEFAULT 'pending' NOT NULL,
	"last_enriched_at" timestamp,
	"last_refreshed_at" timestamp,
	"score" integer,
	"score_reasons" jsonb,
	"status" "prospect_status" DEFAULT 'new' NOT NULL,
	"manual_overrides" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "searches" (
	"id" text PRIMARY KEY NOT NULL,
	"query" text NOT NULL,
	"resolved_name" text,
	"lat" double precision,
	"lon" double precision,
	"radius_m" integer,
	"country_code" text,
	"osm_id" integer,
	"is_area" boolean DEFAULT false NOT NULL,
	"categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "search_status" DEFAULT 'queued' NOT NULL,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "suppressions" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"value" text NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "outreach" ALTER COLUMN "lead_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "outreach" ADD COLUMN "prospect_id" text;--> statement-breakpoint
ALTER TABLE "outreach" ADD COLUMN "channel" text DEFAULT 'email' NOT NULL;--> statement-breakpoint
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_search_id_searches_id_fk" FOREIGN KEY ("search_id") REFERENCES "public"."searches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "prospects_search_source_idx" ON "prospects" USING btree ("search_id","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "prospects_identity_idx" ON "prospects" USING btree ("country_code","normalized_name","address_line");--> statement-breakpoint
CREATE INDEX "prospects_status_idx" ON "prospects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "prospects_score_idx" ON "prospects" USING btree ("score");--> statement-breakpoint
CREATE UNIQUE INDEX "suppressions_kind_value_idx" ON "suppressions" USING btree ("kind","value");--> statement-breakpoint
ALTER TABLE "outreach" ADD CONSTRAINT "outreach_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;