CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"public_id" text NOT NULL,
	"project_id" uuid NOT NULL,
	"invoice_number" text NOT NULL,
	"stripe_id" text NOT NULL,
	"stripe_payment_page" text NOT NULL,
	"total" numeric(19,4) NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "phases" DROP COLUMN "actor_type";--> statement-breakpoint
ALTER TABLE "phases" DROP COLUMN "actor_id";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "actor_type";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "actor_id";--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_public_id_index" ON "invoices" ("public_id");--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;