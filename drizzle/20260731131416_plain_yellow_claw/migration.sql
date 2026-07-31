ALTER TABLE "invoices" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "currency" char(3);--> statement-breakpoint
UPDATE "invoices" SET "organization_id" = "projects"."organization_id", "currency" = "phases"."currency" FROM "phases", "projects" WHERE "invoices"."phase_id" = "phases"."id" AND "phases"."project_id" = "projects"."id";--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "currency" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_stripe_id_uidx" ON "invoices" ("stripe_id");--> statement-breakpoint
CREATE INDEX "invoices_organization_id_idx" ON "invoices" ("organization_id");--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
