CREATE TABLE "invoice" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"project_id" uuid NOT NULL,
	"invoice_number" text NOT NULL,
	"stripe_id" text NOT NULL UNIQUE,
	"payment_page" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id");