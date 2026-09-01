CREATE TYPE "public"."lead_kind" AS ENUM('job', 'funding', 'cofounder');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('harvested', 'disqualified', 'needs_scoring', 'scored', 'parked', 'needs_draft', 'drafted', 'in_gmail', 'answered', 'won', 'lost', 'closed');--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text,
	"type" text NOT NULL,
	"meta" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" text PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"kind" "lead_kind" DEFAULT 'job' NOT NULL,
	"status" "lead_status" DEFAULT 'harvested' NOT NULL,
	"content_hash" text NOT NULL,
	"external_id" text,
	"company" text NOT NULL,
	"title" text NOT NULL,
	"region" text,
	"remote_scope" text,
	"is_contract" boolean DEFAULT false NOT NULL,
	"contact" text,
	"is_direct" boolean DEFAULT false NOT NULL,
	"url" text,
	"pay_raw" text,
	"pay_min_usd_hr" integer,
	"stack" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"summary" text,
	"trigger_event" text,
	"overlap_hours" integer,
	"posted_at" timestamp,
	"harvested_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outreach" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"step" integer DEFAULT 0 NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"proof_used" jsonb,
	"angle" text,
	"gmail_draft_id" text,
	"verified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"sent_at" timestamp,
	"due_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "run_metrics" (
	"id" text PRIMARY KEY NOT NULL,
	"run_at" timestamp DEFAULT now() NOT NULL,
	"raw_count" integer NOT NULL,
	"after_hash" integer NOT NULL,
	"after_filter" integer NOT NULL,
	"scored_count" integer NOT NULL,
	"drafted_count" integer NOT NULL,
	"tokens_in" integer,
	"tokens_out" integer,
	"duration_ms" integer
);
--> statement-breakpoint
CREATE TABLE "scores" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"pre_score" integer NOT NULL,
	"model_score" integer,
	"tier" text,
	"reason" text,
	"rubric_version" text NOT NULL,
	"scored_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_run_at" timestamp,
	"last_ok" boolean DEFAULT true NOT NULL,
	"last_error" text
);
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach" ADD CONSTRAINT "outreach_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_type_idx" ON "events" USING btree ("type");--> statement-breakpoint
CREATE UNIQUE INDEX "leads_hash_idx" ON "leads" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "leads_status_idx" ON "leads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "leads_company_idx" ON "leads" USING btree ("company");--> statement-breakpoint
CREATE INDEX "outreach_lead_idx" ON "outreach" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "scores_lead_idx" ON "scores" USING btree ("lead_id");