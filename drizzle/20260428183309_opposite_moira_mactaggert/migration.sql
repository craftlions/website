CREATE TYPE "milestone_state" AS ENUM('submitted', 'planned', 'approved', 'in_progress', 'invoiced', 'paid', 'cancelled');--> statement-breakpoint
CREATE TABLE "milestone" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"cost" numeric(19,4) DEFAULT '0' NOT NULL,
	"currency" char(3) DEFAULT 'EUR' NOT NULL,
	"state" "milestone_state" DEFAULT 'submitted'::"milestone_state" NOT NULL,
	"due_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "milestone_project_id_index" ON "milestone" ("project_id");--> statement-breakpoint
ALTER TABLE "milestone" ADD CONSTRAINT "milestone_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON UPDATE CASCADE;