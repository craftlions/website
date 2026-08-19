CREATE TYPE "invoice_component" AS ENUM('upfront', 'delivery', 'acceptance');--> statement-breakpoint
DROP INDEX "invoices_phase_id_uidx";--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "component" "invoice_component";--> statement-breakpoint
UPDATE "invoices" SET "component" = 'acceptance' WHERE "phase_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_phase_component_uidx" ON "invoices" ("phase_id","component");--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_phase_component_consistency" CHECK (("phase_id" IS NULL) = ("component" IS NULL));
