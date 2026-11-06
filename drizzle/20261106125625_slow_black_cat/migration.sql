ALTER TABLE "invoices" DROP CONSTRAINT "invoices_phase_component_consistency";--> statement-breakpoint
ALTER INDEX "organization_metadata_stripeCustomerId_idx" RENAME TO "organization_metadata_stripeCustomerId_uidx";--> statement-breakpoint
ALTER TABLE "invoices" DROP COLUMN "invoice_number";--> statement-breakpoint
ALTER TABLE "invoices" DROP COLUMN "stripe_payment_page";--> statement-breakpoint
ALTER TABLE "invoices" DROP COLUMN "total";--> statement-breakpoint
ALTER TABLE "invoices" DROP COLUMN "updated_at";--> statement-breakpoint
ALTER TABLE "invoices" DROP COLUMN "stripe_status";--> statement-breakpoint
ALTER TABLE "invoices" DROP COLUMN "stripe_paid_at";--> statement-breakpoint
ALTER TABLE "invoices" DROP COLUMN "fetched_at";--> statement-breakpoint
ALTER TABLE "invoices" DROP COLUMN "currency";--> statement-breakpoint
ALTER TABLE "invoices" DROP COLUMN "stripe_due_at";--> statement-breakpoint
ALTER TABLE "invoices" DROP COLUMN "invoiced_at";--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "phase_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "component" SET NOT NULL;--> statement-breakpoint
DROP INDEX "organization_metadata_stripeCustomerId_uidx";--> statement-breakpoint
CREATE UNIQUE INDEX "organization_metadata_stripeCustomerId_uidx" ON "organization_metadata" ("stripe_customer_id");