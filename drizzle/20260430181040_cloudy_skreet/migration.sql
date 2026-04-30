CREATE TYPE "actor_type" AS ENUM('user', 'organization');--> statement-breakpoint
CREATE TYPE "aggregate_type" AS ENUM('invoice', 'milestone', 'project');--> statement-breakpoint
CREATE TABLE "event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"aggregate_type" "aggregate_type" NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"version" integer NOT NULL,
	"actor_type" "actor_type" NOT NULL,
	"actor_id" text NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoice" RENAME TO "invoice_old";--> statement-breakpoint
CREATE UNIQUE INDEX "event_aggregate_type_aggregate_id_version_index" ON "event" ("aggregate_type","aggregate_id","version");--> statement-breakpoint
CREATE VIEW "invoice" AS (select "aggregate_id" as "id", "payload"->>'project_id' as "project_id", "payload"->>'invoice_number' as "invoice_number", "payload"->>'stripe_id' as "stripe_id", "payload"->>'stripe_payment_page' as "stripe_payment_page", "recorded_at" as "created_at", ("payload"->>'total')::numeric as "total" from "event" where "event"."aggregate_type" = 'invoice' AND "event"."event_type" = 'created');