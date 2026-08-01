CREATE TYPE "invoice_overdue_evaluation_state" AS ENUM('pending', 'eligible', 'ineligible');--> statement-breakpoint
CREATE TYPE "notification_kind" AS ENUM('phase_approval');--> statement-breakpoint
CREATE TYPE "notification_stage" AS ENUM('initial_notice');--> statement-breakpoint
CREATE TYPE "notification_stage_state" AS ENUM('pending', 'sent', 'skipped', 'errored');--> statement-breakpoint
CREATE TABLE "invoice_overdue_evaluation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"invoice_id" uuid NOT NULL,
	"state" "invoice_overdue_evaluation_state" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_intent" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"kind" "notification_kind" NOT NULL,
	"aggregate_type" "aggregate_type" NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"organization_id" text NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"workflow_id" text,
	"dispatched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_stage_result" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"intent_id" uuid NOT NULL,
	"stage" "notification_stage" NOT NULL,
	"state" "notification_stage_state" DEFAULT 'pending'::"notification_stage_state" NOT NULL,
	"sent_message_id" text,
	"sent_at" timestamp with time zone,
	"skipped_reason" text,
	"failures" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_overdue_evaluation_invoice_uidx" ON "invoice_overdue_evaluation" ("invoice_id");--> statement-breakpoint
CREATE INDEX "notification_intent_kind_idx" ON "notification_intent" ("kind");--> statement-breakpoint
CREATE INDEX "notification_intent_state_idx" ON "notification_intent" ("state");--> statement-breakpoint
CREATE INDEX "notification_intent_aggregate_idx" ON "notification_intent" ("aggregate_type","aggregate_id");--> statement-breakpoint
CREATE INDEX "notification_stage_result_intent_idx" ON "notification_stage_result" ("intent_id");--> statement-breakpoint
CREATE INDEX "notification_stage_result_state_idx" ON "notification_stage_result" ("state");--> statement-breakpoint
ALTER TABLE "invoice_overdue_evaluation" ADD CONSTRAINT "invoice_overdue_evaluation_invoice_id_invoices_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "notification_intent" ADD CONSTRAINT "notification_intent_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "notification_stage_result" ADD CONSTRAINT "notification_stage_result_intent_id_notification_intent_id_fkey" FOREIGN KEY ("intent_id") REFERENCES "notification_intent"("id") ON DELETE CASCADE;