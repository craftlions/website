ALTER TABLE "invoices" DROP CONSTRAINT "invoices_project_id_projects_id_fkey";--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "phase_id" uuid;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "stripe_status" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "stripe_paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "fetched_at" timestamp with time zone;--> statement-breakpoint
WITH numbered_invoices AS (
	SELECT
		"id",
		"project_id",
		row_number() OVER (PARTITION BY "project_id" ORDER BY "id") AS row_number
	FROM "invoices"
),
numbered_phases AS (
	SELECT
		"id",
		"project_id",
		row_number() OVER (PARTITION BY "project_id" ORDER BY "id") AS row_number
	FROM "phases"
)
UPDATE "invoices"
SET "phase_id" = numbered_phases."id"
FROM numbered_invoices
INNER JOIN numbered_phases
	ON numbered_invoices."project_id" = numbered_phases."project_id"
	AND numbered_invoices.row_number = numbered_phases.row_number
WHERE "invoices"."id" = numbered_invoices."id";--> statement-breakpoint
DO $$
DECLARE
	invoice_row record;
	new_phase_id uuid;
BEGIN
	FOR invoice_row IN
		SELECT "id", "project_id", "invoice_number", "total"
		FROM "invoices"
		WHERE "phase_id" IS NULL
	LOOP
		INSERT INTO "phases" ("public_id", "project_id", "title", "cost", "currency", "state")
		VALUES (gen_random_uuid()::text, invoice_row."project_id", 'Legacy invoice ' || invoice_row."invoice_number", invoice_row."total", 'EUR', 'invoiced')
		RETURNING "id" INTO new_phase_id;

		UPDATE "invoices"
		SET "phase_id" = new_phase_id
		WHERE "id" = invoice_row."id";
	END LOOP;
END $$;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "phase_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "aggregate_type" SET DATA TYPE text;--> statement-breakpoint
UPDATE "events" SET "aggregate_type" = 'phase' WHERE "aggregate_type" = 'milestone';--> statement-breakpoint
DROP TYPE "aggregate_type";--> statement-breakpoint
CREATE TYPE "aggregate_type" AS ENUM('invoice', 'organization', 'phase', 'project');--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "aggregate_type" SET DATA TYPE "aggregate_type" USING "aggregate_type"::"aggregate_type";--> statement-breakpoint
ALTER TABLE "invoices" DROP COLUMN "project_id";--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "aggregate_id" SET DATA TYPE text USING "aggregate_id"::text;--> statement-breakpoint
CREATE INDEX "events_aggregate_type_id_idx" ON "events" ("aggregate_type","aggregate_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_phase_id_uidx" ON "invoices" ("phase_id");--> statement-breakpoint
CREATE INDEX "phases_project_id_idx" ON "phases" ("project_id");--> statement-breakpoint
CREATE INDEX "projects_organization_id_idx" ON "projects" ("organization_id");--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_phase_id_phases_id_fkey" FOREIGN KEY ("phase_id") REFERENCES "phases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
